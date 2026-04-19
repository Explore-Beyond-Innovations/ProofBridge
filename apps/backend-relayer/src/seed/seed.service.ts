import { Injectable, Logger } from '@nestjs/common';
import { hash as argon2hash } from '@node-rs/argon2';
import { PrismaService } from '@prisma/prisma.service';
import type {
  ChainDeploymentManifest,
  TokenEntry,
} from '@proofbridge/deployment-manifest';
import type { LoadedSeedConfig } from './seed.config';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(config: LoadedSeedConfig): Promise<void> {
    await this.upsertAdmin(config.admin.email, config.admin.password);

    const chainTokens: Array<{
      chainUid: string;
      chainManifest: ChainDeploymentManifest;
      byPairKey: Map<string, string>;
    }> = [];
    for (const manifest of config.manifests) {
      const { chainUid, byPairKey } = await this.upsertChain(manifest);
      chainTokens.push({ chainUid, chainManifest: manifest, byPairKey });
    }

    await this.upsertRoutes(chainTokens, config.routes?.include);

    this.logger.log('seed complete');
  }

  private async upsertAdmin(email: string, password: string): Promise<void> {
    const passwordHash = await argon2hash(password);
    await this.prisma.admin.upsert({
      where: { email },
      create: { email, passwordHash },
      update: { passwordHash },
    });
    this.logger.log(`admin upserted (${email})`);
  }

  private async upsertChain(manifest: ChainDeploymentManifest): Promise<{
    chainUid: string;
    byPairKey: Map<string, string>;
  }> {
    const { chain, contracts, tokens } = manifest;
    const chainIdBig = BigInt(chain.chainId);
    const adManagerAddress = contracts.adManager.address;
    const orderPortalAddress = contracts.orderPortal.address;

    const row = await this.prisma.chain.upsert({
      where: { chainId: chainIdBig },
      create: {
        name: chain.name,
        chainId: chainIdBig,
        kind: chain.kind,
        adManagerAddress,
        orderPortalAddress,
        mmr: { create: { chainId: chain.chainId } },
      },
      update: {
        name: chain.name,
        adManagerAddress,
        orderPortalAddress,
      },
      select: { id: true },
    });

    const byPairKey = new Map<string, string>();
    for (const tok of tokens) {
      const tokenId = await this.upsertToken(row.id, tok);
      byPairKey.set(tok.pairKey, tokenId);
    }

    this.logger.log(
      `chain "${chain.name}" (id=${chain.chainId}, kind=${chain.kind}) upserted with ${tokens.length} token(s)`,
    );
    return { chainUid: row.id, byPairKey };
  }

  private async upsertToken(
    chainUid: string,
    tok: TokenEntry,
  ): Promise<string> {
    const assetIssuer = tok.kind === 'SAC' ? (tok.assetIssuer ?? null) : null;
    if (tok.kind === 'SAC' && !assetIssuer) {
      throw new Error(
        `token ${tok.symbol} is SAC but manifest.assetIssuer is missing`,
      );
    }
    const row = await this.prisma.token.upsert({
      where: {
        chainUid_address: { chainUid, address: tok.address },
      },
      create: {
        chainUid,
        symbol: tok.symbol,
        name: tok.name,
        address: tok.address,
        decimals: tok.decimals,
        kind: tok.kind,
        assetIssuer,
      },
      update: {
        symbol: tok.symbol,
        name: tok.name,
        decimals: tok.decimals,
        kind: tok.kind,
        assetIssuer,
      },
      select: { id: true },
    });
    return row.id;
  }

  private async upsertRoutes(
    chains: Array<{ chainUid: string; byPairKey: Map<string, string> }>,
    includeOnly?: string[],
  ): Promise<void> {
    if (chains.length < 2) {
      this.logger.log('only one chain configured — skipping route pass');
      return;
    }

    const includeSet = includeOnly ? new Set(includeOnly) : null;
    let upserted = 0;

    for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const a = chains[i];
        const b = chains[j];
        const shared = [...a.byPairKey.keys()].filter((k) =>
          b.byPairKey.has(k),
        );
        for (const pairKey of shared) {
          if (includeSet && !includeSet.has(pairKey)) continue;
          const aTok = a.byPairKey.get(pairKey)!;
          const bTok = b.byPairKey.get(pairKey)!;
          await this.upsertRoute(aTok, bTok);
          await this.upsertRoute(bTok, aTok);
          upserted += 2;
        }
      }
    }

    this.logger.log(`routes upserted: ${upserted}`);
  }

  private async upsertRoute(
    orderTokenId: string,
    adTokenId: string,
  ): Promise<void> {
    await this.prisma.route.upsert({
      where: { orderTokenId_adTokenId: { orderTokenId, adTokenId } },
      create: { orderTokenId, adTokenId },
      update: {},
    });
  }
}
