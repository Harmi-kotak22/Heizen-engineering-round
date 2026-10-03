import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'https://heizen-engineering-round.vercel.app/',
  });

  const port = process.env.PORT ?? 3001;

  await app.listen(port);

  console.log(`Backend running on port ${port}`);
}

bootstrap();