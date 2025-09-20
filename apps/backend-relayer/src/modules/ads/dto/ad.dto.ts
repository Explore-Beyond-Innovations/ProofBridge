import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryAdsDto {
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsString()
  creatorAddress?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'PAUSED' | 'EXHAUSTED' | 'CLOSED';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;
}

export class CreateAdDto {
  @IsUUID()
  routeId!: string;

  @IsString()
  creatorDstAddress!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class FundAdDto {
  @Matches(/^\d+$/)
  poolAmountTopUp!: string;
}

export class WithdrawalAdDto {
  @Matches(/^\d+$/)
  poolAmountWithdraw!: string;
}

export class UpdateAdDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'] as const)
  status?: 'ACTIVE' | 'PAUSED';

  @IsOptional()
  @Matches(/^\d+$/)
  minAmount?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  maxAmount?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ConfirmChainActionDto {
  @IsString() signature!: string;
  @IsString() logId!: string;
  @IsOptional() @IsString() txHash?: string;
}
