import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CompanyAddressDto,
  CompanyDomainDto,
  CompanyDto,
  CompanyHolidayDto,
  EmployeeDto,
  EmployeeListQueryDto,
  EmployeeUpdateDto,
} from './dto/companies.dto.js';

const companyDetails = {
  emailDomains: { orderBy: { domain: 'asc' as const } },
  addresses: { orderBy: [{ active: 'desc' as const }, { label: 'asc' as const }] },
  holidays: { orderBy: { date: 'asc' as const } },
  priceTier: true,
  owner: { select: { id: true, name: true, email: true, active: true } },
  defaultDriver: { select: { id: true, name: true, email: true, active: true } },
};

const employeeDetails = {
  company: { select: { id: true, name: true, active: true } },
  allergies: { include: { allergen: true } },
  dietaryPreferences: { include: { dietaryTag: true } },
};
const publicEmailDomains = new Set([
  'aol.com',
  'fastmail.com',
  'gmail.com',
  'gmx.com',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mail.com',
  'me.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
  'yandex.com',
]);

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanies(page: number, limit: number, search?: string) {
    const where: Prisma.CompanyWhereInput = search
      ? { name: { contains: search.trim(), mode: 'insensitive' } }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: companyDetails,
      }),
      this.prisma.company.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: companyDetails,
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async createCompany(dto: CompanyDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Company name is required');
    if (dto.ownerEmployeeId) {
      throw new BadRequestException('Create the company first, then assign an owner employee belonging to it');
    }
    const emailDomains = this.normalizeDomains(dto.emailDomains ?? []);
    await this.ensureDomainsAvailable(emailDomains);
    await this.validateCompanyReferences(null, dto);
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
          active: dto.active ?? true,
          billingContactName: dto.billingContactName?.trim() || null,
          billingContactEmail: dto.billingContactEmail?.trim().toLowerCase() || null,
          billingContactPhone: dto.billingContactPhone?.trim() || null,
          priceTierId: dto.priceTierId ?? null,
          defaultDeliveryTime: dto.defaultDeliveryTime ?? null,
          deliveryLeadMinutes: dto.deliveryLeadMinutes ?? 60,
          defaultPackaging: dto.defaultPackaging?.trim() || null,
          driverInstructions: dto.driverInstructions?.trim() || null,
          defaultDriverId: dto.defaultDriverId ?? null,
          ownerEmployeeId: dto.ownerEmployeeId ?? null,
          mondayEnabled: dto.mondayEnabled ?? true,
          tuesdayEnabled: dto.tuesdayEnabled ?? true,
          wednesdayEnabled: dto.wednesdayEnabled ?? true,
          thursdayEnabled: dto.thursdayEnabled ?? true,
          fridayEnabled: dto.fridayEnabled ?? true,
          saturdayEnabled: dto.saturdayEnabled ?? false,
          sundayEnabled: dto.sundayEnabled ?? false,
        },
      });
      if (emailDomains.length) {
        await tx.companyEmailDomain.createMany({
          data: emailDomains.map((domain) => ({ companyId: company.id, domain })),
        });
      }
      return tx.company.findUniqueOrThrow({
        where: { id: company.id },
        include: companyDetails,
      });
    });
  }

  async updateCompany(id: string, dto: Partial<CompanyDto>) {
    const existing = await this.getCompany(id);
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Company name is required');
    }
    if (!existing.active && (
      (dto.ownerEmployeeId && dto.ownerEmployeeId !== existing.ownerEmployeeId)
      || (dto.defaultDriverId && dto.defaultDriverId !== existing.defaultDriverId)
    )) {
      throw new BadRequestException('Inactive companies cannot receive new operational relationships');
    }
    const emailDomains = dto.emailDomains === undefined
      ? undefined
      : this.normalizeDomains(dto.emailDomains);
    if (emailDomains) await this.ensureDomainsAvailable(emailDomains, id);
    await this.validateCompanyReferences(id, dto as CompanyDto);
    return this.prisma.$transaction(async (tx) => {
      if (emailDomains) {
        await tx.companyEmailDomain.deleteMany({ where: { companyId: id } });
        if (emailDomains.length) {
          await tx.companyEmailDomain.createMany({
            data: emailDomains.map((domain) => ({ companyId: id, domain })),
          });
        }
      }
      return tx.company.update({
        where: { id },
        data: this.companyScalarData(dto),
        include: companyDetails,
      });
    });
  }

  async setCompanyStatus(id: string, active: boolean) {
    await this.ensureCompanyExists(id);
    return this.prisma.company.update({
      where: { id },
      data: { active },
    });
  }

  async listDrivers() {
    return this.prisma.user.findMany({
      where: {
        active: true,
        role: {
          permissions: {
            some: { permission: { key: 'deliveries.readOwn' } },
          },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async addDomain(companyId: string, dto: CompanyDomainDto) {
    await this.ensureCompanyExists(companyId);
    const domain = this.normalizeDomain(dto.domain);
    const existing = await this.prisma.companyEmailDomain.findFirst({
      where: { domain },
    });
    if (existing) throw new BadRequestException('Email domain is already assigned');
    return this.prisma.companyEmailDomain.create({
      data: { companyId, domain },
    });
  }

  async updateDomain(companyId: string, domainId: string, dto: CompanyDomainDto) {
    await this.ensureCompanyExists(companyId);
    const current = await this.prisma.companyEmailDomain.findFirst({
      where: { id: domainId, companyId },
    });
    if (!current) throw new NotFoundException('Company email domain not found');
    const domain = this.normalizeDomain(dto.domain);
    const duplicate = await this.prisma.companyEmailDomain.findFirst({
      where: { domain, NOT: { id: domainId } },
    });
    if (duplicate) throw new BadRequestException('Email domain is already assigned');
    return this.prisma.companyEmailDomain.update({
      where: { id: domainId },
      data: { domain },
    });
  }

  async removeDomain(companyId: string, domainId: string) {
    const result = await this.prisma.companyEmailDomain.deleteMany({
      where: { id: domainId, companyId },
    });
    if (!result.count) throw new NotFoundException('Company email domain not found');
    return { removed: true };
  }

  async listAddresses(companyId: string) {
    await this.ensureCompanyExists(companyId);
    return this.prisma.companyAddress.findMany({
      where: { companyId },
      orderBy: [{ active: 'desc' }, { label: 'asc' }],
    });
  }

  async addAddress(companyId: string, dto: CompanyAddressDto) {
    await this.ensureCompanyExists(companyId);
    return this.prisma.companyAddress.create({
      data: { companyId, ...this.addressData(dto) },
    });
  }

  async updateAddress(companyId: string, addressId: string, dto: CompanyAddressDto) {
    await this.ensureCompanyExists(companyId);
    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });
    if (!address) throw new NotFoundException('Company address not found');
    return this.prisma.companyAddress.update({
      where: { id: addressId },
      data: this.addressData(dto),
    });
  }

  async setAddressStatus(companyId: string, addressId: string, active: boolean) {
    await this.ensureCompanyExists(companyId);
    const result = await this.prisma.companyAddress.updateMany({
      where: { id: addressId, companyId },
      data: { active },
    });
    if (!result.count) throw new NotFoundException('Company address not found');
    return this.prisma.companyAddress.findUniqueOrThrow({ where: { id: addressId } });
  }

  async listHolidays(companyId: string) {
    await this.ensureCompanyExists(companyId);
    return this.prisma.companyHoliday.findMany({
      where: { companyId },
      orderBy: { date: 'asc' },
    });
  }

  async addHoliday(companyId: string, dto: CompanyHolidayDto) {
    await this.ensureCompanyExists(companyId);
    const date = this.dateOnly(dto.date);
    const existing = await this.prisma.companyHoliday.findUnique({
      where: { companyId_date: { companyId, date } },
    });
    if (existing) throw new BadRequestException('Company holiday already exists for this date');
    return this.prisma.companyHoliday.create({
      data: { companyId, date, name: dto.name.trim() },
    });
  }

  async removeHoliday(companyId: string, holidayId: string) {
    const result = await this.prisma.companyHoliday.deleteMany({
      where: { id: holidayId, companyId },
    });
    if (!result.count) throw new NotFoundException('Company holiday not found');
    return { removed: true };
  }

  async listMenuVisibility(companyId: string) {
    await this.ensureCompanyExists(companyId);
    const [categories, dishes] = await Promise.all([
      this.prisma.companyCategoryVisibility.findMany({
        where: { companyId },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { category: { name: 'asc' } },
      }),
      this.prisma.companyDishVisibility.findMany({
        where: { companyId },
        include: { dish: { select: { id: true, name: true, sku: true } } },
        orderBy: { dish: { name: 'asc' } },
      }),
    ]);
    return { categories, dishes };
  }

  async setCategoryVisibility(companyId: string, categoryId: string, visible: boolean) {
    await this.ensureCompanyExists(companyId);
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.companyCategoryVisibility.upsert({
      where: { companyId_categoryId: { companyId, categoryId } },
      update: { visible },
      create: { companyId, categoryId, visible },
    });
  }

  async setDishVisibility(companyId: string, dishId: string, visible: boolean) {
    await this.ensureCompanyExists(companyId);
    const dish = await this.prisma.dish.findUnique({ where: { id: dishId }, select: { id: true } });
    if (!dish) throw new NotFoundException('Dish not found');
    return this.prisma.companyDishVisibility.upsert({
      where: { companyId_dishId: { companyId, dishId } },
      update: { visible },
      create: { companyId, dishId, visible },
    });
  }

  async listEmployees(query: EmployeeListQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: 'insensitive' } },
              { email: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: employeeDetails,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: employeeDetails,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async createEmployee(dto: EmployeeDto) {
    await this.ensureActiveCompany(dto.companyId);
    await this.validateEmployeeReferences(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    const email = dto.email.trim().toLowerCase();
    const duplicate = await this.prisma.employee.findUnique({
      where: { companyId_email: { companyId: dto.companyId, email } },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('An employee with this email already exists for the company');
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId: dto.companyId,
          name: dto.name.trim(),
          email,
          phone: dto.phone?.trim() || null,
          canChooseAddress: dto.canChooseAddress ?? false,
          canChangeDeliveryTime: dto.canChangeDeliveryTime ?? false,
          canChangePackaging: dto.canChangePackaging ?? false,
          active: dto.active ?? true,
        },
      });
      await this.saveEmployeePreferences(
        tx,
        employee.id,
        dto.allergenIds ?? [],
        dto.dietaryTagIds ?? [],
      );
      return tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: employeeDetails,
      });
    });
  }

  async updateEmployee(id: string, dto: EmployeeUpdateDto) {
    const existing = await this.getEmployee(id);
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const duplicate = await this.prisma.employee.findFirst({
        where: {
          companyId: existing.companyId,
          email,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('An employee with this email already exists for the company');
    }
    await this.validateEmployeeReferences(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    return this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          ...(dto.canChooseAddress !== undefined ? { canChooseAddress: dto.canChooseAddress } : {}),
          ...(dto.canChangeDeliveryTime !== undefined ? { canChangeDeliveryTime: dto.canChangeDeliveryTime } : {}),
          ...(dto.canChangePackaging !== undefined ? { canChangePackaging: dto.canChangePackaging } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      await this.saveEmployeePreferences(
        tx,
        id,
        dto.allergenIds,
        dto.dietaryTagIds,
      );
      return tx.employee.findUniqueOrThrow({
        where: { id },
        include: employeeDetails,
      });
    });
  }

  private companyScalarData(
    dto: Partial<CompanyDto>,
  ): Prisma.CompanyUncheckedUpdateInput {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.billingContactName !== undefined ? { billingContactName: dto.billingContactName?.trim() || null } : {}),
      ...(dto.billingContactEmail !== undefined ? { billingContactEmail: dto.billingContactEmail?.trim().toLowerCase() || null } : {}),
      ...(dto.billingContactPhone !== undefined ? { billingContactPhone: dto.billingContactPhone?.trim() || null } : {}),
      ...(dto.priceTierId !== undefined ? { priceTierId: dto.priceTierId } : {}),
      ...(dto.defaultDeliveryTime !== undefined ? { defaultDeliveryTime: dto.defaultDeliveryTime || null } : {}),
      ...(dto.deliveryLeadMinutes !== undefined ? { deliveryLeadMinutes: dto.deliveryLeadMinutes } : {}),
      ...(dto.defaultPackaging !== undefined ? { defaultPackaging: dto.defaultPackaging?.trim() || null } : {}),
      ...(dto.driverInstructions !== undefined ? { driverInstructions: dto.driverInstructions?.trim() || null } : {}),
      ...(dto.defaultDriverId !== undefined ? { defaultDriverId: dto.defaultDriverId } : {}),
      ...(dto.ownerEmployeeId !== undefined ? { ownerEmployeeId: dto.ownerEmployeeId } : {}),
      ...(dto.mondayEnabled !== undefined ? { mondayEnabled: dto.mondayEnabled } : {}),
      ...(dto.tuesdayEnabled !== undefined ? { tuesdayEnabled: dto.tuesdayEnabled } : {}),
      ...(dto.wednesdayEnabled !== undefined ? { wednesdayEnabled: dto.wednesdayEnabled } : {}),
      ...(dto.thursdayEnabled !== undefined ? { thursdayEnabled: dto.thursdayEnabled } : {}),
      ...(dto.fridayEnabled !== undefined ? { fridayEnabled: dto.fridayEnabled } : {}),
      ...(dto.saturdayEnabled !== undefined ? { saturdayEnabled: dto.saturdayEnabled } : {}),
      ...(dto.sundayEnabled !== undefined ? { sundayEnabled: dto.sundayEnabled } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
  }

  private addressData(dto: CompanyAddressDto) {
    return {
      label: dto.label.trim(),
      line1: dto.line1.trim(),
      line2: dto.line2?.trim() || null,
      city: dto.city.trim(),
      state: dto.state.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country?.trim() || 'USA',
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
  }

  private async validateCompanyReferences(companyId: string | null, dto: CompanyDto) {
    if (dto.priceTierId) {
      const tier = await this.prisma.pricingTier.findUnique({ where: { id: dto.priceTierId } });
      if (!tier) throw new BadRequestException('Pricing tier not found');
    }
    if (dto.defaultDriverId) {
      const driver = await this.prisma.user.findFirst({
        where: {
          id: dto.defaultDriverId,
          active: true,
          role: {
            permissions: {
              some: { permission: { key: 'deliveries.readOwn' } },
            },
          },
        },
      });
      if (!driver) throw new BadRequestException('Default driver must be an active user with delivery-driver permission');
    }
    if (dto.ownerEmployeeId) {
      const owner = await this.prisma.employee.findFirst({
        where: {
          id: dto.ownerEmployeeId,
          active: true,
          ...(companyId ? { companyId } : {}),
        },
      });
      if (!owner) throw new BadRequestException('Company owner must be an active employee belonging to the company');
    }
  }

  private normalizeDomains(domains: string[]) {
    const normalized = domains.map((domain) => this.normalizeDomain(domain));
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('Email domains must be unique');
    }
    return normalized;
  }

  private async ensureDomainsAvailable(domains: string[], exceptCompanyId?: string) {
    if (!domains.length) return;
    const existing = await this.prisma.companyEmailDomain.findFirst({
      where: {
        domain: { in: domains },
        ...(exceptCompanyId ? { companyId: { not: exceptCompanyId } } : {}),
      },
      select: { domain: true },
    });
    if (existing) {
      throw new BadRequestException(`Email domain ${existing.domain} is already assigned`);
    }
  }

  private normalizeDomain(domain: string) {
    const normalized = domain.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '');
    if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(normalized)) {
      throw new BadRequestException('Email domain is invalid');
    }
    if ([...publicEmailDomains].some((publicDomain) =>
      normalized === publicDomain || normalized.endsWith(`.${publicDomain}`),
    )) {
      throw new BadRequestException('Public email provider domains cannot be assigned to a company');
    }
    return normalized;
  }

  private dateOnly(value: string) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) throw new BadRequestException('Holiday date is invalid');
    return date;
  }

  private async validateEmployeeReferences(allergenIds: string[], dietaryTagIds: string[]) {
    if (new Set(allergenIds).size !== allergenIds.length) {
      throw new BadRequestException('Allergen selections must be unique');
    }
    if (new Set(dietaryTagIds).size !== dietaryTagIds.length) {
      throw new BadRequestException('Dietary preference selections must be unique');
    }
    const [allergens, dietaryTags] = await Promise.all([
      allergenIds.length
        ? this.prisma.allergen.count({ where: { id: { in: allergenIds } } })
        : 0,
      dietaryTagIds.length
        ? this.prisma.dietaryTag.count({ where: { id: { in: dietaryTagIds } } })
        : 0,
    ]);
    if (allergens !== allergenIds.length) throw new BadRequestException('One or more allergens were not found');
    if (dietaryTags !== dietaryTagIds.length) throw new BadRequestException('One or more dietary tags were not found');
  }

  private async saveEmployeePreferences(
    tx: Prisma.TransactionClient,
    employeeId: string,
    allergenIds?: string[],
    dietaryTagIds?: string[],
  ) {
    if (allergenIds !== undefined) {
      await tx.employeeAllergy.deleteMany({ where: { employeeId } });
      if (allergenIds.length) {
        await tx.employeeAllergy.createMany({
          data: allergenIds.map((allergenId) => ({ employeeId, allergenId })),
        });
      }
    }
    if (dietaryTagIds !== undefined) {
      await tx.employeeDietaryPreference.deleteMany({ where: { employeeId } });
      if (dietaryTagIds.length) {
        await tx.employeeDietaryPreference.createMany({
          data: dietaryTagIds.map((dietaryTagId) => ({ employeeId, dietaryTagId })),
        });
      }
    }
  }

  private async ensureCompanyExists(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');
  }

  private async ensureActiveCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    if (!company.active) throw new BadRequestException('Inactive companies cannot receive new employees');
  }
}
