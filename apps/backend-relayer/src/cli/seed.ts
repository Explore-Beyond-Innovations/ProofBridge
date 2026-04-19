// CLI entry for seeding the relayer DB: `pnpm seed[:dev] --config <yaml>`.
// Config references one deployment manifest per chain (local path or https URL).

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SeedModule } from '../seed/seed.module';
import { SeedService } from '../seed/seed.service';
import { loadSeedConfig } from '../seed/seed.config';

function parseFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

async function main(): Promise<void> {
  const log = new Logger('seed');
  const configPath = parseFlag(process.argv.slice(2), '--config');
  if (!configPath) {
    console.error(
      'Usage: seed --config <seed.config.yaml>\n' +
        'See apps/backend-relayer/seed.config.example.yaml for the schema.',
    );
    process.exit(2);
  }

  log.log(`loading seed config from ${configPath}`);
  const config = await loadSeedConfig(configPath);
  log.log(
    `loaded ${config.manifests.length} chain manifest(s) for admin=${config.admin.email}`,
  );

  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const seed = app.get(SeedService);
    await seed.run(config);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
