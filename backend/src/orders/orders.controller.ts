import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import {
  AdminOrderOverrideDto,
  CreateOrderDto,
  KitchenHolidayDto,
  KitchenSettingsDto,
  OrderListQueryDto,
  RejectOrderDto,
  UpdateOrderDto,
} from './dto/orders.dto.js';
import { OrdersService } from './orders.service.js';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @RequirePermission('orders.create')
  create(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.orders.create(dto, request.user.id);
  }

  @Get('orders/employees')
  @RequirePermission('orders.create')
  listOrderEmployees() {
    return this.orders.listOrderEmployees();
  }

  @Get('orders/context/:employeeId')
  getOrderContext(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user.permissions.some((permission) =>
      ['orders.create', 'orders.manage'].includes(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.orders.getOrderContext(employeeId);
  }

  @Get('orders')
  @RequirePermission('orders.read')
  list(@Query() query: OrderListQueryDto) {
    return this.orders.list(query);
  }

  @Get('orders/:id')
  @RequirePermission('orders.read')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.get(id);
  }

  @Patch('orders/:id')
  @RequirePermission('orders.manage')
  updateDraft(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.orders.updateDraft(id, dto, request.user.id);
  }

  @Post('orders/:id/place')
  @RequirePermission('orders.create')
  place(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.orders.place(id, request.user.id);
  }

  @Post('orders/:id/return-to-draft')
  @RequirePermission('orders.manage')
  returnToDraft(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.orders.returnToDraft(id, request.user.id);
  }

  @Post('orders/:id/cancel')
  @RequirePermission('orders.manage')
  cancel(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.orders.cancel(id, request.user.id);
  }

  @Post('orders/:id/confirm')
  @RequirePermission('orders.manage')
  confirm(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.orders.confirm(id, request.user.id);
  }

  @Post('orders/:id/reject')
  @RequirePermission('orders.manage')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejectOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user.permissions.includes('orders.manage')) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.orders.reject(id, request.user.id, body.reason);
  }
  @Patch('orders/:id/operational-override')
  @RequirePermission('orders.manage')
  operationalOverride(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminOrderOverrideDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.orders.operationalOverride(id, dto, request.user.id);
  }

  @Get('kitchen/settings')
  @RequirePermission('kitchen.read')
  getKitchenSettings() {
    return this.orders.getKitchenSettings();
  }

  @Patch('kitchen/settings')
  @RequirePermission('kitchen.manage')
  updateKitchenSettings(@Body() dto: KitchenSettingsDto) {
    return this.orders.updateKitchenSettings(dto);
  }

  @Get('kitchen/holidays')
  @RequirePermission('kitchen.read')
  listKitchenHolidays() {
    return this.orders.listKitchenHolidays();
  }

  @Post('kitchen/holidays')
  @RequirePermission('kitchen.manage')
  addKitchenHoliday(@Body() dto: KitchenHolidayDto) {
    return this.orders.addKitchenHoliday(dto);
  }

  @Delete('kitchen/holidays/:id')
  @RequirePermission('kitchen.manage')
  removeKitchenHoliday(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.removeKitchenHoliday(id);
  }

  @Post('kitchen/cutoff/process')
  @RequirePermission('kitchen.manage')
  processCutoff(@Req() request: AuthenticatedRequest) {
    return this.orders.processCutoff(request.user.id);
  }
}
