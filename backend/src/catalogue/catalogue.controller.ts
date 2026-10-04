import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import {
  AddGroupSizeDto,
  AddOptionToGroupDto,
  CatalogueListQueryDto,
  CreateCategoryDto,
  CreateDishDto,
  CreateOptionDto,
  CreateOptionGroupDto,
  SetOptionExtraChargeDto,
  UpdateCategoryDto,
  UpdateDishDto,
  UpdateOptionDto,
  UpdateOptionGroupDto,
} from './dto/catalogue.dto.js';
import { CatalogueService } from './catalogue.service.js';

@Controller('catalogue')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('categories')
  @RequirePermission('catalogue.read')
  listCategories(@Query() query: CatalogueListQueryDto) {
    const active = query.active === undefined ? undefined : query.active === 'true';
    return this.catalogueService.listCategories(
      active,
      query.search,
      query.page,
      query.limit,
    );
  }

  @Get('categories/:id')
  @RequirePermission('catalogue.read')
  getCategory(@Param('id') id: string) {
    return this.catalogueService.getCategory(id);
  }

  @Post('categories')
  @RequirePermission('catalogue.manage')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogueService.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermission('catalogue.manage')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalogueService.updateCategory(id, dto);
  }

  @Patch('categories/:id/status')
  @RequirePermission('catalogue.manage')
  setCategoryStatus(@Param('id') id: string, @Body('active') active: boolean) {
    return this.catalogueService.setCategoryStatus(id, active);
  }

  @Post('categories/:categoryId/dishes/:dishId')
  @RequirePermission('catalogue.manage')
  addDishToCategory(
    @Param('categoryId') categoryId: string,
    @Param('dishId') dishId: string,
    @Body('displayOrder') displayOrder = 0,
  ) {
    return this.catalogueService.addDishToCategory(
      categoryId,
      dishId,
      Number(displayOrder),
    );
  }

  @Delete('categories/:categoryId/dishes/:dishId')
  @RequirePermission('catalogue.manage')
  removeDishFromCategory(
    @Param('categoryId') categoryId: string,
    @Param('dishId') dishId: string,
  ) {
    return this.catalogueService.removeDishFromCategory(categoryId, dishId);
  }

  @Get('dishes')
  @RequirePermission('catalogue.read')
  listDishes(@Query() query: CatalogueListQueryDto) {
    return this.catalogueService.listDishes({
      active: query.active === undefined ? undefined : query.active === 'true',
      stationId: query.stationId,
      categoryId: query.categoryId,
      temperature: query.temperature,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('dishes/:id')
  @RequirePermission('catalogue.read')
  getDish(@Param('id') id: string) {
    return this.catalogueService.getDish(id);
  }

  @Post('dishes')
  @RequirePermission('catalogue.manage')
  createDish(@Body() dto: CreateDishDto) {
    return this.catalogueService.createDish(dto);
  }

  @Patch('dishes/:id')
  @RequirePermission('catalogue.manage')
  updateDish(@Param('id') id: string, @Body() dto: UpdateDishDto) {
    return this.catalogueService.updateDish(id, dto);
  }

  @Patch('dishes/:id/status')
  @RequirePermission('catalogue.manage')
  setDishStatus(@Param('id') id: string, @Body('active') active: boolean) {
    return this.catalogueService.setDishStatus(id, active);
  }

  @Get('options')
  @RequirePermission('catalogue.read')
  listOptions(@Query() query: CatalogueListQueryDto) {
    return this.catalogueService.listOptions(
      query.active === undefined ? undefined : query.active === 'true',
      query.search,
      query.page,
      query.limit,
    );
  }

  @Get('options/:id')
  @RequirePermission('catalogue.read')
  getOption(@Param('id') id: string) {
    return this.catalogueService.getOption(id);
  }

  @Post('options')
  @RequirePermission('catalogue.manage')
  createOption(@Body() dto: CreateOptionDto) {
    return this.catalogueService.createOption(dto);
  }

  @Patch('options/:id')
  @RequirePermission('catalogue.manage')
  updateOption(@Param('id') id: string, @Body() dto: UpdateOptionDto) {
    return this.catalogueService.updateOption(id, dto);
  }

  @Patch('options/:id/status')
  @RequirePermission('catalogue.manage')
  setOptionStatus(@Param('id') id: string, @Body('active') active: boolean) {
    return this.catalogueService.setOptionStatus(id, active);
  }

  @Post('dishes/:dishId/option-groups')
  @RequirePermission('catalogue.manage')
  createOptionGroup(
    @Param('dishId') dishId: string,
    @Body() dto: CreateOptionGroupDto,
  ) {
    return this.catalogueService.createOptionGroup(dishId, dto);
  }

  @Patch('option-groups/:groupId')
  @RequirePermission('catalogue.manage')
  updateOptionGroup(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateOptionGroupDto,
  ) {
    return this.catalogueService.updateOptionGroup(groupId, dto);
  }

  @Delete('option-groups/:groupId')
  @RequirePermission('catalogue.manage')
  deleteOptionGroup(@Param('groupId') groupId: string) {
    return this.catalogueService.deleteOptionGroup(groupId);
  }

  @Post('option-groups/:groupId/options')
  @RequirePermission('catalogue.manage')
  addOptionToGroup(
    @Param('groupId') groupId: string,
    @Body() dto: AddOptionToGroupDto,
  ) {
    return this.catalogueService.addOptionToGroup(groupId, dto);
  }

  @Delete('option-groups/:groupId/options/:optionId')
  @RequirePermission('catalogue.manage')
  removeOptionFromGroup(
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.catalogueService.removeOptionFromGroup(groupId, optionId);
  }

  @Post('option-groups/:groupId/sizes')
  @RequirePermission('catalogue.manage')
  addPortionSizeToGroup(
    @Param('groupId') groupId: string,
    @Body() dto: AddGroupSizeDto,
  ) {
    return this.catalogueService.addPortionSizeToGroup(groupId, dto);
  }

  @Delete('option-groups/:groupId/sizes/:portionSizeId')
  @RequirePermission('catalogue.manage')
  removePortionSizeFromGroup(
    @Param('groupId') groupId: string,
    @Param('portionSizeId') portionSizeId: string,
  ) {
    return this.catalogueService.removePortionSizeFromGroup(
      groupId,
      portionSizeId,
    );
  }

  @Patch('option-groups/:groupId/options/:optionId/pricing')
  @RequirePermission('catalogue.manage')
  setOptionExtraCharge(
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
    @Body() dto: SetOptionExtraChargeDto,
  ) {
    return this.catalogueService.setOptionExtraCharge(groupId, optionId, dto);
  }
}
