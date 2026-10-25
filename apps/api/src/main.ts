import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SAAS_CONFIG } from '@koki/types';

async function bootstrap() {
  const logger = new Logger('KokiAPI');
  const app = await NestFactory.create(AppModule);

  // Increase body size limit to support photo uploads and base64 avatars
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ limit: '15mb', extended: true }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3333;

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Pipes & Filters
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${SAAS_CONFIG.productName} API`)
    .setDescription(
      'Documentação da API REST do Koki - SaaS de Gestão Especializado em Confeitarias, Pastelarias e Padarias',
    )
    .setVersion(SAAS_CONFIG.version)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Koki API - Documentação Swagger',
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 ${SAAS_CONFIG.productName} API rodando na porta ${port} (0.0.0.0)`);
  logger.log(`📚 Documentação Swagger ativa em: http://localhost:${port}/api/docs`);
  logger.log(`🌐 Base URL: http://localhost:${port}/api/v1`);
}

bootstrap();
