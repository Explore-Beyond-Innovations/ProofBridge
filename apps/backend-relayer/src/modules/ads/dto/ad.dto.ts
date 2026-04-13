import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JsonObject, JsonArray } from '@prisma/client/runtime/library';

export class QueryAdsDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'UUID of the route to filter ads by',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({
    description: "Creator's blockchain address",
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsOptional()
  @IsString()
  creatorAddress?: string;

  @ApiPropertyOptional({
    description: 'Chain ID of the ad token',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  adChainId?: number;

  @ApiPropertyOptional({
    description: 'Chain ID of the order token',
    example: 298,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  orderChainId?: number;

  @ApiPropertyOptional({
    description: 'Ad token ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  adTokenId?: string;

  @ApiPropertyOptional({
    description: 'Order token ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  orderTokenId?: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'PAUSED', 'EXHAUSTED', 'CLOSED'],
    description: 'Current status of the ad',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'PAUSED', 'EXHAUSTED', 'CLOSED'] as const)
  status?: 'ACTIVE' | 'PAUSED' | 'EXHAUSTED' | 'CLOSED';

  @ApiPropertyOptional({
    description: 'Pagination cursor',
    example: '5',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    type: Number,
    description: 'Number of items to return per page',
    example: 10,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;
}

export class CreateAdDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'UUID of the route to create ad for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  routeId!: string;

  @ApiProperty({
    description: 'Destination blockchain address of the creator',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsString()
  creatorDstAddress!: string;

  @ApiProperty({
    description: 'Initial amount to fund the ad pool (in smallest unit)',
    example: '1000000000000000000',
  })
  @Matches(/^\d+$/)
  fundAmount!: string;

  @ApiPropertyOptional({
    pattern: '^d+$',
    description: 'Minimum amount for the ad (in smallest unit)',
    example: '100000000000000000',
  })
  @IsOptional()
  @Matches(/^\d+$/)
  minAmount?: string;

  @ApiPropertyOptional({
    pattern: '^d+$',
    description: 'Maximum amount for the ad (in smallest unit)',
    example: '5000000000000000000',
  })
  @IsOptional()
  @Matches(/^\d+$/)
  maxAmount?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Additional metadata for the ad',
    example: { title: 'My Ad', description: 'Ad description' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class FundAdDto {
  @ApiProperty({
    pattern: '^d+$',
    description: 'Amount to add to the ad pool (in smallest unit)',
    example: '1000000000000000000',
  })
  @Matches(/^\d+$/)
  poolAmountTopUp!: string;
}

export class WithdrawalAdDto {
  @ApiProperty({
    pattern: '^d+$',
    description: 'Amount to withdraw from the ad pool (in smallest unit)',
    example: '1000000000000000000',
  })
  @Matches(/^\d+$/)
  poolAmountWithdraw!: string;

  @ApiProperty({
    description: 'Destination address for withdrawal',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsString()
  to!: string;
}

export class UpdateAdDto {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'PAUSED'],
    description: 'New status for the ad',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'] as const)
  status?: 'ACTIVE' | 'PAUSED';

  @ApiPropertyOptional({
    pattern: '^d+$',
    description: 'Minimum amount for the ad (in smallest unit)',
    example: '100000000000000000',
  })
  @IsOptional()
  @Matches(/^\d+$/)
  minAmount?: string;

  @ApiPropertyOptional({
    pattern: '^d+$',
    description: 'Maximum amount for the ad (in smallest unit)',
    example: '5000000000000000000',
  })
  @IsOptional()
  @Matches(/^\d+$/)
  maxAmount?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Updated metadata for the ad',
    example: { title: 'Updated Ad', description: 'New description' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CloseAdDto {
  @ApiProperty({
    description: 'Address to send remaining funds when closing the ad',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  @IsString()
  to!: string;
}

export class ConfirmAdActionDto {
  @ApiProperty({
    description: 'Transaction hash of the chain action',
    example:
      '0x123f681646d4a755815f9cb19e1acc8565a0c2ac8e625e37ef3dbf9c8feb8a7e',
  })
  @IsString()
  txHash!: string;

  @ApiPropertyOptional({
    description: 'Optional signature for the chain action',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @IsOptional()
  @IsString()
  signature?: string;
}

export class TokenDto {
  @ApiProperty({ type: String, description: 'Token name' })
  name!: string;
  @ApiProperty({ type: String, description: 'Token symbol' })
  symbol!: string;
  @ApiProperty({ type: String, description: 'Token contract address' })
  address!: string;
  @ApiProperty({ type: String, description: 'Token decimal places' })
  decimals!: number;
  @ApiProperty({ type: String, description: 'Blockchain chain ID' })
  chainId!: string;
  @ApiProperty({
    enum: ['ERC20', 'NATIVE'],
    description: 'Token kind (e.g., ERC20, NATIVE)',
  })
  kind!: string;
}

export class AdResponseDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Unique identifier of the ad entry',
  })
  id!: string;

  @ApiProperty({ description: 'EVM address of the ad creator' })
  creatorAddress!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Associated route identifier',
  })
  routeId!: string;

  @ApiProperty({ description: 'Token ID for the source/input token' })
  adTokenId!: string;

  @ApiProperty({ description: 'Token ID for the target/output token' })
  orderTokenId!: string;

  @ApiProperty({
    pattern: '^d+$',
    description: 'Total amount allocated to the pool (in smallest token units)',
  })
  poolAmount!: string;

  @ApiProperty({
    pattern: '^d+$',
    description:
      'Current available amount in the pool (in smallest token units)',
  })
  availableAmount!: string;

  @ApiProperty({
    pattern: '^d+$',
    nullable: true,
    description: 'Minimum transaction amount allowed (in smallest token units)',
  })
  minAmount!: string | null;

  @ApiProperty({
    pattern: '^d+$',
    nullable: true,
    description: 'Maximum transaction amount allowed (in smallest token units)',
  })
  maxAmount!: string | null;

  @ApiProperty({
    enum: ['ACTIVE', 'PAUSED', 'EXHAUSTED', 'CLOSED'],
    description: 'Current status of the advertisement',
  })
  status!: string;

  @ApiProperty({
    nullable: true,
    description: 'Additional custom metadata associated with the ad',
  })
  metadata!: string | number | boolean | JsonObject | JsonArray | null;

  @ApiProperty({ type: TokenDto, description: 'Details of the ad token' })
  adToken!: TokenDto;

  @ApiProperty({ type: TokenDto, description: 'Details of the order token' })
  orderToken!: TokenDto;

  @ApiProperty({ description: 'Timestamp when the ad entry was created' })
  createdAt!: string;

  @ApiProperty({ description: 'Timestamp of the last update to the ad entry' })
  updatedAt!: string;
}

export class ListAdResponseDto {
  @ApiProperty({ type: [AdResponseDto] })
  data!: AdResponseDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class CreateAdResponseDto {
  @ApiProperty({
    description: 'Blockchain chain ID where the ad contract is deployed',
    example: '1',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Contract address for the advertisement',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  contractAddress!: string;

  @ApiProperty({
    description: 'Signature for the transaction request',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  signature!: `0x${string}`;

  @ApiPropertyOptional({
    description:
      'Signer public key (Stellar chains only — 0x-prefixed 32-byte hex of the relayer signer)',
  })
  signerPublicKey?: string;

  @ApiProperty({
    description: 'Request auth token',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  authToken!: string;

  @ApiProperty({
    description: 'Time until the request expires',
    example: 3600,
  })
  timeToExpire!: number;

  @ApiProperty({
    description: 'Unique identifier for the advertisement',
    example: 'ad123',
  })
  adId!: string;

  @ApiProperty({
    description: 'Token address for the advertisement',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  adToken!: `0x${string}`;

  @ApiProperty({
    pattern: '^d+$',
    description: 'Initial Amount to fund the ad pool with',
  })
  initialAmount!: string;

  @ApiProperty({
    description: 'Chain ID for the order',
    example: '1',
  })
  orderChainId!: string;

  @ApiProperty({
    description: 'Recipient address for the advertisement',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  adRecipient!: `0x${string}`;

  @ApiProperty({
    description: 'Request hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  reqHash!: `0x${string}`;
}
export class FundAdResponseDto {
  @ApiProperty({
    description: 'Blockchain chain ID where the ad contract is deployed',
    example: '1',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Contract address for the advertisement',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  contractAddress!: string;

  @ApiProperty({
    description: 'Signature for the transaction request',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  signature!: `0x${string}`;

  @ApiProperty({
    description: 'Request auth token',
    example: '0xd35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  authToken!: string;

  @ApiProperty({
    description: 'Time until the request expires',
    example: 3600,
  })
  timeToExpire!: number;

  @ApiProperty({
    description: 'Unique identifier for the advertisement',
    example: 'ad123',
  })
  adId!: string;

  @ApiProperty({
    description: 'Amount to fund',
    example: '1000000000000000000',
  })
  amount!: string;

  @ApiProperty({
    description: 'Request hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  reqHash!: `0x${string}`;
}

export class WithdrawAdResponseDto {
  @ApiProperty({
    description: 'Blockchain chain ID where the ad contract is deployed',
    example: '1',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Contract address for the advertisement',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  contractAddress!: string;

  @ApiProperty({
    description: 'Signature for the transaction request',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  signature!: `0x${string}`;

  @ApiProperty({
    description: 'Request auth token',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  authToken!: string;

  @ApiProperty({
    description: 'Time until the request expires',
    example: 3600,
  })
  timeToExpire!: number;

  @ApiProperty({
    description: 'Unique identifier for the advertisement',
    example: 'ad123',
  })
  adId!: string;

  @ApiProperty({
    description: 'Amount to withdraw',
    example: '1000000000000000000',
  })
  amount!: string;

  @ApiProperty({
    description: 'Destination address for withdrawal',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  to!: `0x${string}`;

  @ApiProperty({
    description: 'Request hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  reqHash!: `0x${string}`;
}

export class ConfirmChainActionADResponseDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Ad identifier',
    example: 'b693ab22-5e73-47e8-9937-1d4459b8c081',
  })
  adId!: string;

  @ApiProperty({
    description: 'Whether the chain action was confirmed successfully',
    example: true,
  })
  success!: boolean;
}

export class AdUpdateResponseDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Unique identifier of the ad entry',
  })
  id!: string;

  @ApiProperty({
    description: 'EVM address of the ad creator',
  })
  creatorAddress!: string;

  @ApiProperty({
    pattern: '^d+$',
    nullable: true,
    description: 'Minimum transaction amount allowed (in smallest token units)',
  })
  minAmount!: string | null;

  @ApiProperty({
    pattern: '^d+$',
    nullable: true,
    description: 'Maximum transaction amount allowed (in smallest token units)',
  })
  maxAmount!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Additional custom metadata associated with the ad',
  })
  metadata!: string | number | boolean | JsonObject | JsonArray | null;
}

export class CloseAdResponseDto {
  @ApiProperty({
    description: 'Blockchain chain ID where the ad contract is deployed',
    example: '1',
  })
  chainId!: string;

  @ApiProperty({
    description: 'Contract address for the advertisement',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  contractAddress!: string;

  @ApiProperty({
    description: 'Signature for the transaction request',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  signature!: `0x${string}`;

  @ApiProperty({
    description: 'Request auth token',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  authToken!: string;

  @ApiProperty({
    description: 'Time until the request expires',
    example: 3600,
  })
  timeToExpire!: number;

  @ApiProperty({
    description: 'Unique identifier for the advertisement',
    example: 'ad123',
  })
  adId!: string;

  @ApiProperty({
    description: 'Destination address for withdrawal',
    example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  })
  to!: `0x${string}`;

  @ApiProperty({
    description: 'Request hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  reqHash!: `0x${string}`;
}
