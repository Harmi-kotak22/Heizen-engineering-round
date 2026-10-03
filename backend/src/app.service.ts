import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'success',
      message: 'NestJS is running!',
      database: 'Connected to Neon PostgreSQL',
      timestamp: new Date().toISOString(),
    };
  }
}