import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SafeExceptionFilter } from './common/filters/safe-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const httpLogger = new Logger('HTTP');

  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  express.set('trust proxy', 1);
  express.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = thisRequestId(request.get('x-request-id'));
    (request as Request & { requestId: string }).requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    const startedAt = Date.now();
    response.on('finish', () => {
      if (request.path === '/health' || request.path === '/health/live') return;
      httpLogger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          ip: request.ip,
        }),
      );
    });
    if (request.method === 'TRACE' || request.method === 'TRACK') {
      response.status(405).send('Method Not Allowed');
      return;
    }
    next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
      noSniff: true,
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: {
        directives: {
          baseUri: ["'self'"],
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
    }),
  );
  app.use(compression());

  const configuredOrigins = String(config.get<string>('WEB_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    ...configuredOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://[::1]:3001',
  ]);
  const allowLocalDevOrigin = (origin: string) => {
    if (config.get<string>('NODE_ENV') === 'production') return false;
    try {
      const url = new URL(origin);
      return url.protocol === 'http:' && ['3000', '3001'].includes(url.port);
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || allowLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());

  if (!isProduction || config.get<string>('ENABLE_SWAGGER') === 'true') {
    const openApi = new DocumentBuilder()
      .setTitle('Josum Student Accommodation API')
      .setDescription('Multi-residence applications, availability, documents, notifications, and administration.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, openApi), {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('API_PORT') ?? 4000;
  await app.listen(port);
}

function thisRequestId(value?: string) {
  const candidate = value?.trim();
  return candidate && /^[a-zA-Z0-9._-]{8,100}$/.test(candidate) ? candidate : randomUUID();
}

bootstrap();
