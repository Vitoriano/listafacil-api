import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Atrás do Traefik (Dokploy): IP real do cliente para o throttler e logs
  app.set('trust proxy', 1);

  app.setGlobalPrefix('v1');
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Lista Fácil API')
    .setDescription('Backend API for Lista Fácil shopping app')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
