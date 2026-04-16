import { ApiProperty } from '@nestjs/swagger';
import { ChainKind } from '@prisma/client';

export class UserWalletDto {
  @ApiProperty({
    description:
      'Canonical wallet address — 0x-prefixed for EVM, 0x+64hex for Stellar',
  })
  address!: string;

  @ApiProperty({ enum: ChainKind })
  chainKind!: ChainKind;

  @ApiProperty({ description: 'When this wallet was first linked' })
  createdAt!: Date;
}

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty() username!: string;

  @ApiProperty({
    type: [UserWalletDto],
    description: 'Wallets linked to this user (at most one per chain kind)',
  })
  wallets!: UserWalletDto[];
}
