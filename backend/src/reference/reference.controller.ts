import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permissions.decorator.js';
import {
  CreateAllergenDto,
  CreateDietaryTagDto,
  CreatePortionSizeDto,
  CreateStationDto,
  UpdateAllergenDto,
  UpdateDietaryTagDto,
  UpdatePortionSizeDto,
  UpdateStationDto,
} from './dto/reference.dto.js';
import { ReferenceService } from './reference.service.js';

@Controller('reference')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('stations')
  @RequirePermission('catalogue.read')
  listStations() {
    return this.referenceService.listStations();
  }

  @Post('stations')
  @RequirePermission('catalogue.manage')
  createStation(@Body() dto: CreateStationDto) {
    return this.referenceService.createStation(dto);
  }

  @Patch('stations/:id')
  @RequirePermission('catalogue.manage')
  updateStation(@Param('id') id: string, @Body() dto: UpdateStationDto) {
    return this.referenceService.updateStation(id, dto);
  }

  @Patch('stations/:id/status')
  @RequirePermission('catalogue.manage')
  setStationStatus(@Param('id') id: string, @Body('active') active: boolean) {
    return this.referenceService.setStationStatus(id, active);
  }

  @Get('allergens')
  @RequirePermission('catalogue.read')
  listAllergens() {
    return this.referenceService.listAllergens();
  }

  @Post('allergens')
  @RequirePermission('catalogue.manage')
  createAllergen(@Body() dto: CreateAllergenDto) {
    return this.referenceService.createAllergen(dto);
  }

  @Patch('allergens/:id')
  @RequirePermission('catalogue.manage')
  updateAllergen(@Param('id') id: string, @Body() dto: UpdateAllergenDto) {
    return this.referenceService.updateAllergen(id, dto);
  }

  @Get('dietary-tags')
  @RequirePermission('catalogue.read')
  listDietaryTags() {
    return this.referenceService.listDietaryTags();
  }

  @Post('dietary-tags')
  @RequirePermission('catalogue.manage')
  createDietaryTag(@Body() dto: CreateDietaryTagDto) {
    return this.referenceService.createDietaryTag(dto);
  }

  @Patch('dietary-tags/:id')
  @RequirePermission('catalogue.manage')
  updateDietaryTag(@Param('id') id: string, @Body() dto: UpdateDietaryTagDto) {
    return this.referenceService.updateDietaryTag(id, dto);
  }

  @Get('portion-sizes')
  @RequirePermission('catalogue.read')
  listPortionSizes() {
    return this.referenceService.listPortionSizes();
  }

  @Post('portion-sizes')
  @RequirePermission('catalogue.manage')
  createPortionSize(@Body() dto: CreatePortionSizeDto) {
    return this.referenceService.createPortionSize(dto);
  }

  @Patch('portion-sizes/:id')
  @RequirePermission('catalogue.manage')
  updatePortionSize(
    @Param('id') id: string,
    @Body() dto: UpdatePortionSizeDto,
  ) {
    return this.referenceService.updatePortionSize(id, dto);
  }

  @Patch('portion-sizes/:id/status')
  @RequirePermission('catalogue.manage')
  setPortionSizeStatus(
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    return this.referenceService.setPortionSizeStatus(id, active);
  }
}
