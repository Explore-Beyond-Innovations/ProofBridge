import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { ChainAdapterService } from '../../chain-adapters/chain-adapter.service';
import { RequestFaucetDto, FaucetResponseDto } from './dto/faucet.dto';
import { Request } from 'express';
import { UserService } from '../user/user.service';

@Injectable()
export class FaucetService {
  private readonly logger = new Logger(FaucetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chainAdapters: ChainAdapterService,
    private readonly users: UserService,
  ) {}

  async requestFaucet(
    req: Request,
    dto: RequestFaucetDto,
  ): Promise<FaucetResponseDto | undefined> {
    const userId = req.user?.sub;
    this.logger.log(
      `[faucet] begin userId=${userId ?? '<none>'} tokenId=${dto.tokenId}`,
    );
    try {
      const reqUser = req.user;

      if (!reqUser) throw new UnauthorizedException('Not authenticated');

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
      this.logger.log(
        `[faucet] token lookup ok symbol=${token.symbol} chainId=${token.chain.chainId} kind=${token.chain.kind}`,
      );

      const recipient = await this.users.getWalletForChain(
        reqUser.sub,
        token.chain.kind,
      );
      this.logger.log(
        `[faucet] recipient resolved chainKind=${token.chain.kind} recipient=${recipient}`,
      );

      const provider = this.chainAdapters.forChain(token.chain.kind);

      // Check user's token balance
      this.logger.log(
        `[faucet] checking balance tokenAddress=${token.address} account=${recipient}`,
      );
      const balance = await provider.checkTokenBalance({
        chainId: token.chain.chainId.toString(),
        tokenAddress: token.address as `0x${string}`,
        account: recipient as `0x${string}`,
      });
      this.logger.log(`[faucet] current balance=${balance}`);

      // Define threshold (e.g., 10,000 tokens)
      const BALANCE_THRESHOLD = '10000000000000000000000'; // 100k tokens with 18 decimals

      if (BigInt(balance) >= BigInt(BALANCE_THRESHOLD)) {
        throw new BadRequestException(
          `Balance threshold exceeded. Current balance: ${balance}`,
        );
      }

      this.logger.log(
        `[faucet] minting tokenAddress=${token.address} receiver=${recipient}`,
      );
      const result = await provider.mintToken({
        chainId: token.chain.chainId.toString(),
        tokenAddress: token.address as `0x${string}`,
        receiver: recipient as `0x${string}`,
      });
      this.logger.log(`[faucet] mint ok txHash=${result.txHash}`);

      return {
        txHash: result.txHash,
        symbol: token.symbol,
        chainId: token.chain.chainId.toString(),
        amount: '1000000',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `[faucet] failed userId=${userId ?? '<none>'} tokenId=${dto.tokenId}: ${msg}`,
      );
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
