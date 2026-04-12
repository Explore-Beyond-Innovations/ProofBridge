import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ChainAdapterService } from '../../src/chain-adapters/chain-adapter.service';
import { MockChainAdapter } from './mock-chain-adapter';

export async function createTestingApp(): Promise<INestApplication> {
  const mockAdapter = new MockChainAdapter();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ChainAdapterService)
    .useValue({ forChain: () => mockAdapter })
    .compile();

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
