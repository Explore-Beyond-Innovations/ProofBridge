import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ChainAdapterService } from '../../src/chain-adapters/chain-adapter.service';
import { MockChainAdapter } from './mock-chain-adapter';

export interface CreateTestingAppOptions {
  // When true, bypass the MockChainAdapter override so the real chain-adapter
  // service is used. Required for `test:integrations` which drives real
  // on-chain EVM + Stellar contracts.
  useRealChainAdapters?: boolean;
}

export async function createTestingApp(
  opts: CreateTestingAppOptions = {},
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (!opts.useRealChainAdapters) {
    const mockAdapter = new MockChainAdapter();
    builder
      .overrideProvider(ChainAdapterService)
      .useValue({ forChain: () => mockAdapter });
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
