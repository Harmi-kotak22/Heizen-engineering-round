import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CompanyListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEmail()
  billingContactEmail?: string | null;

  @IsOptional()
  @IsString()
  billingContactName?: string | null;

  @IsOptional()
  @IsString()
  billingContactPhone?: string | null;

  @IsOptional()
  @IsUUID()
  priceTierId?: string | null;

  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  defaultDeliveryTime?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryLeadMinutes?: number;

  @IsOptional()
  @IsString()
  defaultPackaging?: string | null;

  @IsOptional()
  @IsString()
  driverInstructions?: string | null;

  @IsOptional()
  @IsUUID()
  defaultDriverId?: string | null;

  @IsOptional()
  @IsUUID()
  ownerEmployeeId?: string | null;

  @IsOptional()
  @IsBoolean()
  mondayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tuesdayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  wednesdayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  thursdayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  fridayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  saturdayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sundayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emailDomains?: string[];
}

export class CompanyStatusDto {
  @IsBoolean()
  active!: boolean;
}

export class CompanyDomainDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))+$/)
  domain!: string;
}

export class CompanyAddressDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string | null;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CompanyHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class EmployeeListQueryDto extends CompanyListQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class EmployeeDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  canChooseAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangeDeliveryTime?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangePackaging?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dietaryTagIds?: string[];
}

export class EmployeeUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  canChooseAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangeDeliveryTime?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangePackaging?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dietaryTagIds?: string[];
}
