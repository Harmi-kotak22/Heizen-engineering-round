import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import {
  CreatePricingTierDto,
  SetPricingItemPriceDto,
  UpdatePricingTierDto,
} from './dto/pricing.dto.js';
import { PricingService } from './pricing.service.js';

@Controller('pricing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  @RequirePermission('pricing.read')
  listTiers() {
    return this.pricingService.listTiers();
  }

  @Get('tiers/:id')
  @RequirePermission('pricing.read')
  getTier(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pricingService.getTier(id);
  }

  @Post('tiers')
  @RequirePermission('pricing.manage')
  createTier(@Body() dto: CreatePricingTierDto) {
    return this.pricingService.createTier(dto);
  }

  @Patch('tiers/:id')
  @RequirePermission('pricing.manage')
  updateTier(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePricingTierDto,
  ) {
    return this.pricingService.updateTier(id, dto);
  }

  @Patch('tiers/:id/default')
  @RequirePermission('pricing.manage')
  setDefaultTier(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pricingService.setDefaultTier(id);
  }

  @Get('tiers/:tierId/dishes')
  @RequirePermission('pricing.read')
  listDishPrices(@Param('tierId', new ParseUUIDPipe()) tierId: string) {
    return this.pricingService.listTierDishCoverage(tierId);
  }

  @Patch('tiers/:tierId/dishes/:dishId')
  @RequirePermission('pricing.manage')
  updateDishPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('dishId', new ParseUUIDPipe()) dishId: string,
    @Body() dto: SetPricingItemPriceDto,
  ) {
    return this.pricingService.updateDishPrice(tierId, dishId, dto);
  }

  @Delete('tiers/:tierId/dishes/:dishId')
  @RequirePermission('pricing.manage')
  clearDishPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('dishId', new ParseUUIDPipe()) dishId: string,
  ) {
    return this.pricingService.clearDishPrice(tierId, dishId);
  }

  @Get('tiers/:tierId/dishes/:dishId/price')
  @RequirePermission('pricing.read')
  resolveDishPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('dishId', new ParseUUIDPipe()) dishId: string,
  ) {
    return this.pricingService.resolveDishPrice(tierId, dishId);
  }

  @Get('tiers/:tierId/options')
  @RequirePermission('pricing.read')
  listOptionPrices(@Param('tierId', new ParseUUIDPipe()) tierId: string) {
    return this.pricingService.listTierOptionCoverage(tierId);
  }

  @Patch('tiers/:tierId/options/:optionId')
  @RequirePermission('pricing.manage')
  updateOptionPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
    @Body() dto: SetPricingItemPriceDto,
  ) {
    return this.pricingService.updateOptionPrice(tierId, optionId, dto);
  }

  @Delete('tiers/:tierId/options/:optionId')
  @RequirePermission('pricing.manage')
  clearOptionPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
  ) {
    return this.pricingService.clearOptionPrice(tierId, optionId);
  }

  @Get('tiers/:tierId/options/:optionId/price')
  @RequirePermission('pricing.read')
  resolveOptionPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('optionId', new ParseUUIDPipe()) optionId: string,
  ) {
    return this.pricingService.resolveOptionPrice(tierId, optionId);
  }
}
