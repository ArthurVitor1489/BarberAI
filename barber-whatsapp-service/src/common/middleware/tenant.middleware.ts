import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const barbershopId = req.headers['x-barbershop-id'] || req.query['barbershopId'];

    // O webhook do WhatsApp resolve o tenant dinamicamente a partir do payload recebido,
    // por isso não exigimos o header nas rotas do webhook.
    if (req.originalUrl.startsWith('/whatsapp/webhook')) {
      return next();
    }

    // Para APIs administrativas, o cabeçalho de tenant é obrigatório
    const isAdministrativeRoute = 
      req.originalUrl.startsWith('/dashboard') ||
      req.originalUrl.startsWith('/appointments') ||
      req.originalUrl.startsWith('/customers') ||
      req.originalUrl.startsWith('/barbers') ||
      req.originalUrl.startsWith('/services');

    if (isAdministrativeRoute && !barbershopId) {
      throw new BadRequestException('O cabeçalho x-barbershop-id é obrigatório para identificar a barbearia.');
    }

    if (barbershopId) {
      req['barbershopId'] = barbershopId as string;
    }

    next();
  }
}
