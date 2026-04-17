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
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TokenKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueryTokensDto {
  @ApiPropertyOptional({
    description: 'Filter by chain uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  chainUid?: string;

  @ApiPropertyOptional({
    description: 'Filter by EVM chain id',
    example: '1',
    type: String,
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  chainId?: string;

  @ApiPropertyOptional({
    description: 'Filter by token symbol',
    example: 'ETH',
  })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({
    description: 'Filter by token address',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Pagination cursor',
    example: 'eyJpZCI6MTAwLCJfcG9pbnRzVG9OZXh0SXRlbXMiOnRydWV9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 25,
    example: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class CreateTokenDto {
  @ApiProperty({
    description: 'Internal chain UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  chainUid!: string;

  @ApiProperty({
    description: 'Token symbol',
    example: 'ETH',
  })
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @ApiProperty({
    description: 'Token name',
    example: 'Ethereum',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Token address (will be lowercased)',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({
    description: 'Token decimals',
    minimum: 0,
    maximum: 30,
    example: 18,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  decimals!: number;

  @ApiPropertyOptional({
    description: 'Token kind',
    enum: TokenKind,
    example: 'NATIVE',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(TokenKind, {
    message: `kind must be one of: ${Object.values(TokenKind).join(', ')}`,
  })
  kind?: TokenKind;

  @ApiPropertyOptional({
    description:
      'Stellar classic-asset issuer (G-strkey). Required when kind is SAC.',
    example: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  })
  // Only SAC tokens carry a classic-asset issuer; for other kinds the field
  // is skipped entirely (service layer rejects stray values). When SAC, we
  // require both presence and G-strkey format at the boundary.
  @ValidateIf((o: CreateTokenDto) => o.kind === 'SAC')
  @IsString()
  @IsNotEmpty({ message: 'assetIssuer is required when kind is SAC' })
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'assetIssuer must be a valid Stellar issuer (G-strkey)',
  })
  assetIssuer?: string;
}

export class UpdateTokenDto {
  @ApiPropertyOptional({
    description: 'Internal chain UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  chainUid?: string;

  @ApiPropertyOptional({
    description: 'Token symbol',
    example: 'ETH',
  })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({
    description: 'Token name',
    example: 'Ethereum',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Token address',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Token decimals',
    minimum: 0,
    maximum: 30,
    example: 18,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  decimals?: number;

  @ApiPropertyOptional({
    description: 'Token kind',
    enum: TokenKind,
    example: 'NATIVE',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(TokenKind, {
    message: `kind must be one of: ${Object.values(TokenKind).join(', ')}`,
  })
  kind?: TokenKind;

  @ApiPropertyOptional({
    description:
      'Stellar classic-asset issuer (G-strkey). Pass an empty string to clear (only when kind is moving off SAC).',
    example: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  })
  @IsOptional()
  @IsString()
  // Format gate: any non-empty value must be a valid G-strkey. Empty string
  // is the explicit "clear the issuer" sentinel. Required-when-SAC cross-
  // field enforcement lives in the service layer because an omitted `kind`
  // still means SAC when the existing row is SAC.
  @Matches(/^$|^G[A-Z2-7]{55}$/, {
    message: 'assetIssuer must be empty or a valid Stellar issuer (G-strkey)',
  })
  assetIssuer?: string;
}

export class TokenChainDto {
  @ApiProperty({
    description: 'Chain ID',
    type: 'string',
  })
  id!: string;

  @ApiProperty({
    description: 'Chain name',
    type: 'string',
  })
  name!: string;

  @ApiProperty({
    description: 'EVM chain ID',
    type: 'string',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Chain kind',
    enum: ['EVM', 'STELLAR'],
  })
  kind!: 'EVM' | 'STELLAR';
}

export class TokenDataResponseDto {
  @ApiProperty({
    description: 'Token ID',
    type: 'string',
  })
  id!: string;

  @ApiProperty({
    description: 'Token symbol',
    type: 'string',
  })
  symbol!: string;

  @ApiProperty({
    description: 'Token name',
    type: 'string',
  })
  name!: string;

  @ApiProperty({
    description: 'Token address',
    type: 'string',
  })
  address!: string;

  @ApiProperty({
    description: 'Token decimals',
    type: 'number',
  })
  decimals!: number;

  @ApiProperty({
    description: 'Token kind',
    type: 'string',
  })
  kind!: string;

  @ApiProperty({
    description:
      'Stellar classic-asset issuer (G-strkey). Populated only for SAC tokens.',
    type: 'string',
    nullable: true,
  })
  assetIssuer!: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    type: 'string',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    type: 'string',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Chain information',
    type: TokenChainDto,
  })
  chain!: TokenChainDto;
}

export class ListTokenResponseDto {
  @ApiProperty({
    description: 'Array of token data',
    type: [TokenDataResponseDto],
  })
  data!: TokenDataResponseDto[];

  @ApiProperty({
    description: 'Cursor for the next page of results',
    type: 'string',
    nullable: true,
  })
  nextCursor!: string | null;
}
