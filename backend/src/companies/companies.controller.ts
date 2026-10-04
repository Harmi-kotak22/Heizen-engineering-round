import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  CompanyAddressDto,
  CompanyDomainDto,
  CompanyDto,
  CompanyHolidayDto,
  CompanyListQueryDto,
  CompanyStatusDto,
  EmployeeDto,
  EmployeeListQueryDto,
  EmployeeUpdateDto,
  VisibilityDto,
} from './dto/companies.dto.js';
import { CompaniesService } from './companies.service.js';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('companies')
  @RequirePermission('companies.read')
  listCompanies(@Query() query: CompanyListQueryDto) {
    return this.companiesService.listCompanies(query.page, query.limit, query.search);
  }

  @Get('companies/drivers')
  @RequirePermission('companies.read')
  listDrivers() {
    return this.companiesService.listDrivers();
  }

  @Get('companies/:id')
  @RequirePermission('companies.read')
  getCompany(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.companiesService.getCompany(id);
  }

  @Post('companies')
  @RequirePermission('companies.manage')
  createCompany(@Body() dto: CompanyDto) {
    return this.companiesService.createCompany(dto);
  }

  @Patch('companies/:id')
  @RequirePermission('companies.manage')
  updateCompany(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompanyDto,
  ) {
    return this.companiesService.updateCompany(id, dto);
  }

  @Patch('companies/:id/status')
  @RequirePermission('companies.manage')
  setCompanyStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompanyStatusDto,
  ) {
    return this.companiesService.setCompanyStatus(id, dto.active);
  }

  @Post('companies/:companyId/domains')
  @RequirePermission('companies.manage')
  addDomain(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() dto: CompanyDomainDto,
  ) {
    return this.companiesService.addDomain(companyId, dto);
  }

  @Patch('companies/:companyId/domains/:domainId')
  @RequirePermission('companies.manage')
  updateDomain(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('domainId', new ParseUUIDPipe()) domainId: string,
    @Body() dto: CompanyDomainDto,
  ) {
    return this.companiesService.updateDomain(companyId, domainId, dto);
  }

  @Delete('companies/:companyId/domains/:domainId')
  @RequirePermission('companies.manage')
  removeDomain(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('domainId', new ParseUUIDPipe()) domainId: string,
  ) {
    return this.companiesService.removeDomain(companyId, domainId);
  }

  @Get('companies/:companyId/addresses')
  @RequirePermission('companies.read')
  listAddresses(@Param('companyId', new ParseUUIDPipe()) companyId: string) {
    return this.companiesService.listAddresses(companyId);
  }

  @Post('companies/:companyId/addresses')
  @RequirePermission('companies.manage')
  addAddress(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() dto: CompanyAddressDto,
  ) {
    return this.companiesService.addAddress(companyId, dto);
  }

  @Patch('companies/:companyId/addresses/:addressId')
  @RequirePermission('companies.manage')
  updateAddress(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('addressId', new ParseUUIDPipe()) addressId: string,
    @Body() dto: CompanyAddressDto,
  ) {
    return this.companiesService.updateAddress(companyId, addressId, dto);
  }

  @Patch('companies/:companyId/addresses/:addressId/status')
  @RequirePermission('companies.manage')
  setAddressStatus(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('addressId', new ParseUUIDPipe()) addressId: string,
    @Body() dto: CompanyStatusDto,
  ) {
    return this.companiesService.setAddressStatus(companyId, addressId, dto.active);
  }

  @Get('companies/:companyId/holidays')
  @RequirePermission('companies.read')
  listHolidays(@Param('companyId', new ParseUUIDPipe()) companyId: string) {
    return this.companiesService.listHolidays(companyId);
  }

  @Post('companies/:companyId/holidays')
  @RequirePermission('companies.manage')
  addHoliday(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() dto: CompanyHolidayDto,
  ) {
    return this.companiesService.addHoliday(companyId, dto);
  }

  @Delete('companies/:companyId/holidays/:holidayId')
  @RequirePermission('companies.manage')
  removeHoliday(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('holidayId', new ParseUUIDPipe()) holidayId: string,
  ) {
    return this.companiesService.removeHoliday(companyId, holidayId);
  }

  @Get('companies/:companyId/menu-visibility')
  @RequirePermission('companies.read')
  listMenuVisibility(@Param('companyId', new ParseUUIDPipe()) companyId: string) {
    return this.companiesService.listMenuVisibility(companyId);
  }

  @Patch('companies/:companyId/menu-visibility/categories/:categoryId')
  @RequirePermission('companies.manage')
  setCategoryVisibility(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() dto: VisibilityDto,
  ) {
    return this.companiesService.setCategoryVisibility(companyId, categoryId, dto.visible);
  }

  @Patch('companies/:companyId/menu-visibility/dishes/:dishId')
  @RequirePermission('companies.manage')
  setDishVisibility(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('dishId', new ParseUUIDPipe()) dishId: string,
    @Body() dto: VisibilityDto,
  ) {
    return this.companiesService.setDishVisibility(companyId, dishId, dto.visible);
  }

  @Get('employees')
  @RequirePermission('employees.read')
  listEmployees(@Query() query: EmployeeListQueryDto) {
    return this.companiesService.listEmployees(query);
  }

  @Get('employees/:id')
  @RequirePermission('employees.read')
  getEmployee(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.companiesService.getEmployee(id);
  }

  @Post('employees')
  @RequirePermission('employees.manage')
  createEmployee(@Body() dto: EmployeeDto) {
    return this.companiesService.createEmployee(dto);
  }

  @Patch('employees/:id')
  @RequirePermission('employees.manage')
  updateEmployee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EmployeeUpdateDto,
  ) {
    return this.companiesService.updateEmployee(id, dto);
  }
}
