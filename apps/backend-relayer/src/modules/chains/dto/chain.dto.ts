import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'Ad Manager contract address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'address must be a 0x-prefixed 20-byte hex address',
  })
  @IsString()
  @IsNotEmpty()
  adManagerAddress!: string;

  @ApiProperty({
    description: 'Order Portal contract address',
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
  })
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'address must be a 0x-prefixed 20-byte hex address',
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
