import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsEnum,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainKind } from '@prisma/client';

export class QueryChainsDto {
  @ApiPropertyOptional({
    description: 'Chain name',
    example: 'Ethereum Mainnet',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Chain ID', example: '1' })
  @IsOptional()
  @IsString()
  chainId?: string;

  @ApiPropertyOptional({
    description: 'Cursor for pagination',
    example: 'xyz123',
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

export class CreateChainDto {
  @ApiProperty({ description: 'Chain name', example: 'Ethereum Mainnet' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Chain ID', pattern: '/^d+$', example: '1' })
  @IsString()
  @Matches(/^\d+$/)
  chainId!: string;

  @ApiPropertyOptional({
    description: 'Chain kind (defaults to EVM)',
    enum: ChainKind,
    example: ChainKind.EVM,
  })
  @IsOptional()
  @IsEnum(ChainKind)
  kind?: ChainKind;

  @ApiProperty({
    description: 'Ad Manager contract address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @Matches(/^0x[a-fA-F0-9]{40}(?:[a-fA-F0-9]{24})?$/, {
    message:
      'address must be a 0x-prefixed 20-byte (EVM) or 32-byte (Stellar) hex address',
  })
  @IsString()
  @IsNotEmpty()
  adManagerAddress!: string;

  @ApiProperty({
    description: 'Order Portal contract address',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  @Matches(/^0x[a-fA-F0-9]{40}(?:[a-fA-F0-9]{24})?$/, {
    message:
      'address must be a 0x-prefixed 20-byte (EVM) or 32-byte (Stellar) hex address',
  })
  @IsString()
  @IsNotEmpty()
  orderPortalAddress!: string;
}

export class UpdateChainDto {
  @ApiPropertyOptional({
    description: 'Chain name',
    example: 'Ethereum Mainnet',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Chain ID',
    pattern: '^d+$',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  chainId?: string;

  @ApiPropertyOptional({
    description: 'Chain kind',
    enum: ChainKind,
    example: ChainKind.EVM,
  })
  @IsOptional()
  @IsEnum(ChainKind)
  kind?: ChainKind;

  @ApiPropertyOptional({
    description: 'Ad Manager contract address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsOptional()
  @IsString()
  adManagerAddress?: string;

  @ApiPropertyOptional({
    description: 'Order Portal contract address',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  @IsOptional()
  @IsString()
  orderPortalAddress?: string;
}

export class ChainResponseDto {
  @ApiProperty({ description: 'Chain name', example: 'Ethereum Mainnet' })
  name!: string;

  @ApiProperty({ description: 'Chain ID', example: '1' })
  chainId!: string;

  @ApiProperty({
    description: 'Chain kind',
    enum: ChainKind,
    example: ChainKind.EVM,
  })
  kind!: ChainKind;

  @ApiProperty({
    description: 'Ad Manager contract address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  adManagerAddress!: string;

  @ApiProperty({
    description: 'Order Portal contract address',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  orderPortalAddress!: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-01-01T00:00:00Z',
  })
  updatedAt!: string;
}

export class ListChainsResponseDto {
  @ApiProperty({ type: [ChainResponseDto] })
  data!: ChainResponseDto[];

  @ApiProperty({
    description: 'Next pagination cursor',
    example: 'xyz123',
    nullable: true,
  })
  nextCursor!: string | null;
}
