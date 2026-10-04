import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateStationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateAllergenDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateAllergenDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateDietaryTagDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateDietaryTagDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreatePortionSizeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder = 0;
}

export class UpdatePortionSizeDto {
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
}
