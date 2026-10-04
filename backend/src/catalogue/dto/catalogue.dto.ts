import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  Max,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum DishTemperature {
  HOT = 'HOT',
  COLD = 'COLD',
}

export class CatalogueListQueryDto {
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
  @IsIn(['true', 'false'])
  active?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(DishTemperature)
  temperature?: DishTemperature;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  secret?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  secret?: boolean;
}

export class CreateDishDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsEnum(DishTemperature)
  temperature!: DishTemperature;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  costPrice!: number;

  @IsUUID()
  stationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumOrderQuantity = 1;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dietaryTagIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}

export class UpdateDishDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @IsOptional()
  @IsEnum(DishTemperature)
  temperature?: DishTemperature;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  costPrice?: number;

  @IsOptional()
  @IsUUID()
  stationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumOrderQuantity?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dietaryTagIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  costPrice!: number;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  allergenIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dietaryTagIds?: string[];
}

export class UpdateOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  costPrice?: number;

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

export class CreateOptionGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  optionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  portionSizeIds?: string[];
}

export class UpdateOptionGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class AddOptionToGroupDto {
  @IsUUID()
  optionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class AddGroupSizeDto {
  @IsUUID()
  portionSizeId!: string;
}

export class SetOptionExtraChargeDto {
  @IsUUID()
  portionSizeId!: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  extraCharge!: number;
}
