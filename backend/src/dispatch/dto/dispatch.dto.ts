import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DropStatusEnum {
  KITCHEN_READY = 'KITCHEN_READY',
  DISPATCH_READY = 'DISPATCH_READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export class DispatchBoardQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'deliveryDate must be in YYYY-MM-DD format' })
  deliveryDate?: string;

  @IsOptional()
  @IsEnum(DropStatusEnum)
  status?: DropStatusEnum;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class AssignDriverDto {
  @IsOptional()
  @IsUUID()
  driverId?: string | null;
}

export class MarkDeliveredDto {
  @IsOptional()
  @IsString()
  deliveryNote?: string;

  @IsOptional()
  @IsString()
  deliveryPhotoUrl?: string;
}

export class AdminOverrideTransitionDto {
  @IsNotEmpty()
  @IsEnum(DropStatusEnum)
  targetStatus!: DropStatusEnum;

  @IsOptional()
  @IsString()
  reason?: string;
}
