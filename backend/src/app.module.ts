import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { PermissionsGuard } from './auth/permissions.guard.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { EffectiveMenuModule } from './effective-menu/effective-menu.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { DispatchModule } from './dispatch/dispatch.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ReferenceModule } from './reference/reference.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }

        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
    }),
    ReferenceModule,
    CatalogueModule,
    PricingModule,
    CompaniesModule,
    EffectiveMenuModule,
    OrdersModule,
    DispatchModule,
  ],
  controllers: [AppController, AuthController],
  providers: [
    AppService,
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
    PrismaService,
  ],
})
export class AppModule {}
