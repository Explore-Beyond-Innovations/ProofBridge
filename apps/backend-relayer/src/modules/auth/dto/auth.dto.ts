import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ChainKind } from '@prisma/client';

export class ChallengeDTO {
  @ApiProperty({
    description: 'Chain kind the caller is authenticating with',
    enum: ChainKind,
    example: ChainKind.EVM,
  })
  @IsEnum(ChainKind)
  chainKind!: ChainKind;

  @ApiProperty({
    description:
      'Wallet address — 0x-prefixed 20-byte hex for EVM, G-strkey for Stellar',
    example: '0x1234...',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address!: string;
}

export class LoginDTO {
  @ApiProperty({
    description: 'Chain kind matching the original challenge',
    enum: ChainKind,
    example: ChainKind.EVM,
  })
  @IsEnum(ChainKind)
  chainKind!: ChainKind;

  // EVM (SIWE) path
  @ApiProperty({
    description: 'SIWE message string (EVM path only)',
    required: false,
  })
  @ValidateIf((o: LoginDTO) => o.chainKind === ChainKind.EVM)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message?: string;

  @ApiProperty({
    description: 'SIWE signature (EVM path only)',
    required: false,
  })
  @ValidateIf((o: LoginDTO) => o.chainKind === ChainKind.EVM)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  signature?: string;

  // Stellar (SEP-10) path
  @ApiProperty({
    description:
      'Co-signed SEP-10 challenge transaction, base64 XDR (Stellar path only)',
    required: false,
  })
  @ValidateIf((o: LoginDTO) => o.chainKind === ChainKind.STELLAR)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  transaction?: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token', example: 'eyJhbGciOiJIUzI1...' })
  @IsString()
  @MinLength(10)
  refresh!: string;
}

export class ChallengeResponseDto {
  @ApiProperty({ enum: ChainKind })
  @IsEnum(ChainKind)
  chainKind!: ChainKind;

  @ApiProperty({ description: 'Echoed wallet address (canonical form)' })
  @IsString()
  address!: string;

  @ApiProperty({ description: 'Expiration timestamp (ISO8601)' })
  @IsString()
  expiresAt!: string;

  @ApiProperty({
    description: 'Unique nonce for SIWE (EVM only)',
    required: false,
  })
  @IsOptional()
  @IsString()
  nonce?: string;

  @ApiProperty({ description: 'SIWE domain (EVM only)', required: false })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ description: 'SIWE URI (EVM only)', required: false })
  @IsOptional()
  @IsString()
  uri?: string;

  @ApiProperty({
    description: 'Server-signed SEP-10 challenge transaction (Stellar only)',
    required: false,
  })
  @IsOptional()
  @IsString()
  transaction?: string;

  @ApiProperty({
    description: 'Stellar network passphrase (Stellar only)',
    required: false,
  })
  @IsOptional()
  @IsString()
  networkPassphrase?: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'User information',
    example: {
      id: '123',
      username: 'user123',
    },
  })
  user!: {
    id: string;
    username: string;
  };

  @ApiProperty({
    description: 'Authentication tokens',
    example: {
      access: 'eyJhbGciOiJIUzI1...',
      refresh: 'eyJhbGciOiJIUzI1...',
    },
  })
  tokens!: {
    access: string;
    refresh: string;
  };
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'Authentication tokens',
    example: {
      access: 'eyJhbGciOiJIUzI1...',
      refresh: 'eyJhbGciOiJIUzI1...',
    },
  })
  tokens!: {
    access: string;
    refresh: string;
  };
}
