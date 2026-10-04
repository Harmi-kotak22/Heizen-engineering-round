import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export const PricingDerivationTypeValues = ['NONE', 'COST_FACTOR', 'TIER_PERCENTAGE'] as const;

export class CreatePricingTierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsIn(PricingDerivationTypeValues)
  derivationType?: 'NONE' | 'COST_FACTOR' | 'TIER_PERCENTAGE';

  @IsOptional()
  @IsUUID()
  derivationSourceTierId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,4}(?:\.\d{1,4})?$/)
  derivationFactor?: string;
}

export class UpdatePricingTierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(PricingDerivationTypeValues)
  derivationType?: 'NONE' | 'COST_FACTOR' | 'TIER_PERCENTAGE';

  @IsOptional()
  @IsUUID()
  derivationSourceTierId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,4}(?:\.\d{1,4})?$/)
  derivationFactor?: string;
}

export class SetPricingItemPriceDto {
  @IsString()
  @Matches(/^\d{1,8}(?:\.\d{1,2})?$/)
  price!: string;

  @IsOptional()
  @IsBoolean()
  override?: boolean;
}
