import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is not configured');
        return { secret, signOptions: { expiresIn: '15m' } };
      },
    }),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, PrismaService, AuthService, JwtAuthGuard, PermissionsGuard],
})
export class CompaniesModule {}
