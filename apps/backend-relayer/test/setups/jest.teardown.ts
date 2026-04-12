/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { rmSync } from 'fs';
import { resolve } from 'path';

export default async () => {
  const container = (global as any).__PG_CONTAINER__;
  if (container) {
    await container.stop();
  }

  // Clean up the ravedb leveldb data directory created during tests.
  const leveldbPath = resolve(__dirname, '../../leveldb_data');
  rmSync(leveldbPath, { recursive: true, force: true });
};
