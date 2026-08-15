import 'dotenv/config';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './src/app.module';

let cachedHandler: any = null;

async function createHandler() {
  const app: INestApplication = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api');
  await app.init();

  // Nest's underlying HTTP adapter is Express — get the instance for serverless wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = (app as any).getHttpAdapter().getInstance();
  return serverless(server);
}

export default async function handler(req: any, res: any) {
  if (!cachedHandler) cachedHandler = await createHandler();
  return cachedHandler(req, res);
}
