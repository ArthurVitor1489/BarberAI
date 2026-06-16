import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    req['requestId'] = requestId;

    res.on('finish', () => {
      const executionTime = Date.now() - start;
      const tenantId = req['barbershopId'] || req.headers['x-barbershop-id'] || 'N/A';
      const userId = req['user'] ? (req['user'] as any).id : 'Anonymous';
      const endpoint = `${req.method} ${req.originalUrl}`;
      const statusCode = res.statusCode;

      this.metricsService.incrementRequestCount();
      this.metricsService.addRequestDuration(executionTime);

      this.logger.log(
        `[Request] ID: ${requestId} | Tenant: ${tenantId} | User: ${userId} | ${endpoint} | Status: ${statusCode} | Time: ${executionTime}ms`
      );
    });

    next();
  }
}
