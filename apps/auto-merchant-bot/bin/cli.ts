#!/usr/bin/env -S tsx
import { run } from "../src/run.js"
import { log } from "../src/logger.js"

run().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err)
  log.error("fatal", { error: msg })
  process.exit(1)
})
