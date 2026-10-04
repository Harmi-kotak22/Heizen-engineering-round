import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderSelectionDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  optionId!: string;
}

export class OrderCombinationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  portionSizeId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderSelectionDto)
  selections!: OrderSelectionDto[];
}

export class OrderLineDto {
  @IsUUID()
  dishId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderCombinationDto)
  combinations!: OrderCombinationDto[];
}

export class CreateOrderDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  deliveryDate!: string;

  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  deliveryTime?: string;

  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @IsOptional()
  @IsString()
  packaging?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  deliveryTime?: string;

  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @IsOptional()
  @IsString()
  packaging?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines?: OrderLineDto[];
}

export class RejectOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class OrderListQueryDto {
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
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  invoiced?: string;
}

export class OrderPackagingDto {
  @IsString()
  @IsNotEmpty()
  packaging!: string;
}

export class AdminOrderOverrideDto {
  @IsOptional()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  deliveryTime?: string;

  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  packaging?: string;
}

export class KitchenSettingsDto {
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  cutoffTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  cutoffWorkingDays!: number;

  @IsOptional()
  @IsString()
  timezone?: string;

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
}

export class KitchenHolidayDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
