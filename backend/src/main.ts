import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global Interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global Filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Security
  app.use(helmet());

  // CORS
  const corsOrigins = configService.get<string>('cors.origins', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigins.includes(',') ? corsOrigins.split(',') : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // API Prefix and Versioning
  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Checklist Management System API')
      .setDescription('API documentation for the Checklist Management System')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('roles', 'Role management endpoints')
      .addTag('projects', 'Project management endpoints')
      .addTag('folders', 'Folder management endpoints')
      .addTag('template-types', 'Template type management endpoints')
      .addTag('templates', 'Template management endpoints')
      .addTag('checklist-items', 'Checklist item endpoints')
      .addTag('reports', 'Report generation endpoints')
      .addTag('audit-logs', 'Audit log endpoints')
      .addTag('integrations', 'Third-party integration endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('PORT', 3001);
  const logger = new Logger('Bootstrap');
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/docs`);
}

bootstrap();
