import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;
  private isRedisEnabled = false;
  
  // Estruturas de Fallback em Memória
  private memoryCache = new Map<string, { value: string; expiresAt: number | null }>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT') || 6379;

    if (host) {
      try {
        this.redisClient = new Redis({
          host,
          port,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy: (times) => {
            if (times > 3) {
              return null; // para de tentar reconectar após 3 falhas
            }
            return Math.min(times * 1000, 3000);
          },
        });

        this.redisClient.on('connect', () => {
          this.logger.log(`Redis conectado com sucesso em ${host}:${port}`);
          this.isRedisEnabled = true;
        });

        this.redisClient.on('error', (err) => {
          this.logger.warn(`Conexão com Redis indisponível: ${err.message}. Usando cache/fila local em memória.`);
          this.isRedisEnabled = false;
        });
      } catch (err: any) {
        this.logger.warn(`Erro ao inicializar cliente Redis: ${err.message}. Ativando modo de fallback em memória.`);
        this.isRedisEnabled = false;
      }
    } else {
      this.logger.warn('REDIS_HOST não configurado. As filas e o cache serão executados localmente em memória.');
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  // ==========================================
  // METODOS DE CACHE
  // ==========================================

  async getCache<T>(key: string): Promise<T | null> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err: any) {
        this.logger.error(`Erro ao ler cache do Redis: ${err.message}`);
      }
    }

    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return JSON.parse(cached.value);
  }

  async setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isRedisEnabled && this.redisClient) {
      try {
        if (ttlSeconds) {
          await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.redisClient.set(key, serialized);
        }
        return;
      } catch (err: any) {
        this.logger.error(`Erro ao gravar cache no Redis: ${err.message}`);
      }
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryCache.set(key, { value: serialized, expiresAt });
  }

  async delCache(key: string): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err: any) {
        this.logger.error(`Erro ao excluir cache do Redis: ${err.message}`);
      }
    }

  }

  // ==========================================
  // METODOS DE LOCK DISTRIBUIDO
  // ==========================================

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        const result = await (this.redisClient.set as any)(key, 'locked', 'NX', 'EX', ttlSeconds);
        return result === 'OK';
      } catch (err: any) {
        this.logger.error(`Erro ao adquirir lock no Redis: ${err.message}`);
      }
    }

    // Fallback em memoria
    const cached = this.memoryCache.get(key);
    if (cached && (cached.expiresAt === null || cached.expiresAt > Date.now())) {
      return false; // Lock ja existe e nao expirou
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryCache.set(key, { value: 'locked', expiresAt });
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    if (this.isRedisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err: any) {
        this.logger.error(`Erro ao liberar lock no Redis: ${err.message}`);
      }
    }
    this.memoryCache.delete(key);
  }

  // ==========================================
  // METODOS DE FILA (ASYNCHRONOUS JOB RUNNER)
  // ==========================================

  async addJob(queueName: string, jobData: any, processor: (data: any) => Promise<void>): Promise<void> {
    this.logger.log(`[Queue - ${queueName}] Nova tarefa agendada: ${JSON.stringify(jobData)}`);
    
    // Dispara a tarefa em background sem bloquear o fluxo principal (comportamento de fila assíncrona)
    setImmediate(async () => {
      try {
        await processor(jobData);
        this.logger.log(`[Queue - ${queueName}] Tarefa processada com sucesso.`);
      } catch (err: any) {
        this.logger.error(`[Queue - ${queueName}] Erro ao processar tarefa: ${err.message}`);
      }
    });
  }
}
