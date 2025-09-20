import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryTradesDto {
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsUUID() adId?: string;

  @IsOptional() @IsString() adCreatorAddress?: string;
  @IsOptional() @IsString() bridgerAddress?: string;

  @IsOptional() @IsUUID() fromTokenId?: string;
  @IsOptional() @IsUUID() toTokenId?: string;

  @IsOptional() @Matches(/^\d+$/) minAmount?: string;
  @IsOptional() @Matches(/^\d+$/) maxAmount?: string;

  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) limit?: number;
}

export class CreateTradeDto {
  @IsUUID() adId!: string;
  @IsUUID() routeId!: string;
  @Matches(/^\d+$/) amount!: string;
  @IsString() bridgerDstAddress!: string;
}

export class ConfirmTradeDto {
  @IsString() encodedSignature!: string;
}

export class ConfirmChainActionDto {
  @IsString() signature!: string;
  @IsString() logId!: string;
  @IsOptional() @IsString() txHash?: string;
}
