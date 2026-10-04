import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { EffectiveMenuService } from './effective-menu.service.js';

@Controller('effective-menu')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class EffectiveMenuController {
  constructor(private readonly effectiveMenu: EffectiveMenuService) {}

  @Get('employees/:employeeId')
  @RequirePermission('catalogue.read', 'employees.read')
  getForEmployee(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
  ) {
    return this.effectiveMenu.getForEmployee(employeeId);
  }
}
