import {
  Body,
  Controller,
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
import { DispatchService } from './dispatch.service.js';
import {
  AssignDriverDto,
  DispatchBoardQueryDto,
  MarkDeliveredDto,
} from './dto/dispatch.dto.js';

@Controller('dispatch')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('board')
  @RequirePermission('dispatch.read')
  listBoard(@Query() query: DispatchBoardQueryDto) {
    return this.dispatchService.listDispatchBoard(query);
  }

  @Get('drivers')
  @RequirePermission('dispatch.read')
  listDrivers() {
    return this.dispatchService.listDrivers();
  }

  @Get('drops/:id')
  async getDrop(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const hasDispatchRead = request.user.permissions.includes('dispatch.read');
    const hasDeliveryReadOwn = request.user.permissions.includes('deliveries.readOwn');

    if (!hasDispatchRead && !hasDeliveryReadOwn) {
      throw new ForbiddenException('Insufficient permissions to view drop');
    }

    const drop = await this.dispatchService.getDropDetail(id);

    // If only has deliveries.readOwn, enforce that drop belongs to this driver
    if (!hasDispatchRead && drop.driverId !== request.user.id) {
      throw new ForbiddenException('You can only view your own deliveries');
    }

    return drop;
  }

  @Patch('drops/:id/driver')
  @RequirePermission('dispatch.manage')
  assignDriver(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignDriverDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dispatchService.assignDriver(id, dto, request.user.id);
  }

  @Post('drops/:id/dispatch-ready')
  @RequirePermission('dispatch.manage')
  markDispatchReady(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dispatchService.markDispatchReady(id, request.user.id);
  }

  @Post('drops/:id/out-for-delivery')
  @RequirePermission('dispatch.manage')
  markOutForDelivery(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dispatchService.markOutForDelivery(id, request.user.id);
  }

  @Post('drops/:id/delivered')
  markDelivered(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkDeliveredDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const canManageDispatch = request.user.permissions.includes('dispatch.manage');
    const canManageOwn = request.user.permissions.includes('deliveries.manageOwn');

    if (!canManageDispatch && !canManageOwn) {
      throw new ForbiddenException('Insufficient permissions to mark delivery');
    }

    return this.dispatchService.markDelivered(id, request.user, dto);
  }

  @Get('driver/today')
  @RequirePermission('deliveries.readOwn')
  getDriverToday(@Req() request: AuthenticatedRequest) {
    return this.dispatchService.getDriverTodayDeliveries(request.user.id);
  }
}
