import { NestFactory } from '@nestjs/core';
import morgan from 'morgan';
import * as express from 'express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { env } from '@libs/configs';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const PORT = parseInt(String(env.port), 10) || 2005;
  const app = await NestFactory.create(AppModule);

  const devOrigins = [
    'http://localhost:3000',
    `http://localhost:${PORT}`,
    env.appUri,
  ];
  const prodOrigins = [env.appUri];
  app.enableCors({
    origin: env.isProd ? prodOrigins : devOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT'],
    optionsSuccessStatus: 200,
  });

  app.use(morgan('tiny'));
  app.use(express.json({ limit: 5 << 20 }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerOptions = new DocumentBuilder()
    .setTitle('Proof Relayer API')
    .setVersion('0.1.0')
    .addServer(`http://localhost:${PORT}`, 'Local')
    .addBearerAuth()
    .addCookieAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerOptions);
  SwaggerModule.setup('docs', app, swaggerDocument);

  try {
    await app.listen(PORT);
    console.info(`http://localhost:${PORT}`);
  } catch (err) {
    console.error(err.message);
  }
}

void bootstrap();
