import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { ChainProviderService } from '../../providers/chain/chain-provider.service';
import { RequestFaucetDto, FaucetResponseDto } from './dto/faucet.dto';
import { Request } from 'express';

@Injectable()
export class FaucetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chainProviders: ChainProviderService,
  ) {}

  async requestFaucet(
    req: Request,
    dto: RequestFaucetDto,
  ): Promise<FaucetResponseDto | undefined> {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new UnauthorizedException('Not authenticated');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new UnauthorizedException('Unauthorized');

      const token = await this.prisma.token.findUnique({
        where: { id: dto.tokenId },
        select: {
          id: true,
          symbol: true,
          address: true,
          chain: {
            select: {
              chainId: true,
              kind: true,
            },
          },
        },
      });

      if (!token) {
        throw new NotFoundException(`Token with ID ${dto.tokenId} not found`);
      }

      const provider = this.chainProviders.forChain(token.chain.kind);

      // Check user's token balance
      const balance = await provider.checkTokenBalance({
        chainId: token.chain.chainId.toString(),
        tokenAddress: token.address as `0x${string}`,
        account: user.walletAddress as `0x${string}`,
      });

      // Define threshold (e.g., 10,000 tokens)
      const BALANCE_THRESHOLD = '10000000000000000000000'; // 100k tokens with 18 decimals

      if (BigInt(balance) >= BigInt(BALANCE_THRESHOLD)) {
        throw new BadRequestException(
          `Balance threshold exceeded. Current balance: ${balance}`,
        );
      }

      const result = await provider.mintToken({
        chainId: token.chain.chainId.toString(),
        tokenAddress: token.address as `0x${string}`,
        receiver: user.walletAddress as `0x${string}`,
      });

      return {
        txHash: result.txHash,
        symbol: token.symbol,
        chainId: token.chain.chainId.toString(),
        amount: '1000000',
      };
    } catch (e) {
      if (e instanceof Error) {
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : HttpStatus.BAD_REQUEST;

        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
