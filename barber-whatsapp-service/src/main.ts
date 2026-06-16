import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // 1. Secrets Validation (Fase 7)
  const requiredSecrets = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'REDIS_HOST',
  ];

  const missingSecrets = requiredSecrets.filter((secret) => !process.env[secret]);

  if (missingSecrets.length > 0) {
    console.error('CRITICAL STARTUP ERROR: Missing required environment variables:');
    missingSecrets.forEach((secret) => {
      console.error(` - ${secret}`);
    });
    process.exit(1); // Falha a inicialização da aplicação
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 2. Configuração global de Pipes para validação de DTOs (Fase 5 / class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 3. Configuração do OpenAPI Swagger (Fase 10)
  const config = new DocumentBuilder()
    .setTitle('BarberAI V3 SaaS API')
    .setDescription('Documentação completa das APIs do BarberAI V3 (Gestão e Recepcionista IA)')
    .setVersion('3.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-barbershop-id', in: 'header' }, 'x-barbershop-id')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
