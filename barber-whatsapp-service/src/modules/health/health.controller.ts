import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get overall health status and system metrics' })
  async getHealth() {
    let dbStatus = 'UP';
    let redisStatus = 'UP';
    let openaiStatus = 'UP';

    try {
      await this.checkDb();
    } catch {
      dbStatus = 'DOWN';
    }

    try {
      await this.checkRedis();
    } catch {
      redisStatus = 'DOWN';
    }

    try {
      this.checkOpenAI();
    } catch {
      openaiStatus = 'DOWN';
    }

    const overallStatus = (dbStatus === 'UP' && redisStatus === 'UP' && openaiStatus === 'UP') ? 'UP' : 'DEGRADED';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        openai: openaiStatus,
      },
      metrics: this.metricsService.getMetrics(),
    };
  }

  @Get('db')
  @ApiOperation({ summary: 'Check database connectivity' })
  async getDbHealth() {
    try {
      await this.checkDb();
      return { status: 'UP', message: 'Database connection is healthy.' };
    } catch (err: any) {
      throw new ServiceUnavailableException({ status: 'DOWN', error: err.message });
    }
  }

  @Get('redis')
  @ApiOperation({ summary: 'Check Redis connectivity' })
  async getRedisHealth() {
    try {
      await this.checkRedis();
      return { status: 'UP', message: 'Redis connection is healthy.' };
    } catch (err: any) {
      throw new ServiceUnavailableException({ status: 'DOWN', error: err.message });
    }
  }

  @Get('openai')
  @ApiOperation({ summary: 'Check OpenAI integration' })
  getOpenAIHealth() {
    try {
      this.checkOpenAI();
      return { status: 'UP', message: 'OpenAI integration is configured.' };
    } catch (err: any) {
      throw new ServiceUnavailableException({ status: 'DOWN', error: err.message });
    }
  }

  private async checkDb() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis() {
    const isEnabled = (this.redisService as any).isRedisEnabled;
    const client = (this.redisService as any).redisClient;
    if (isEnabled && client) {
      const res = await client.ping();
      if (res !== 'PONG') {
        throw new Error('Redis ping failed.');
      }
    } else {
      const host = this.configService.get<string>('REDIS_HOST');
      if (host) {
        throw new Error('Redis host configured but connection is offline.');
      }
    }
  }

  private checkOpenAI() {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    if (!key || key === 'mock-key') {
      throw new Error('OpenAI key is missing or is using mock value.');
    }
  }
}
