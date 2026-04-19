# Deploy orchestrator

Top-level entry point that drives the per-chain deploy CLIs under
`contracts/<chain>/deploy/` and the shared bundle fetcher.

Deploys are invoked manually from an operator's machine — no CI
workflow calls this script against a live network. The orchestrator's
default is to pull the published contracts bundle from the
`Proofbridge-Contracts` GitHub release, so the on-chain bytecode always
matches a release anyone can download and diff.

## Typical usage

```bash
# Default: deploy evm + stellar against the latest published bundle
EVM_RPC_URL=…  EVM_ADMIN_PRIVATE_KEY=…  \
STELLAR_NETWORK=testnet  STELLAR_SOURCE_ACCOUNT=admin  \
DEPLOY_ENV=testnet  \
  scripts/deploy/deploy-contracts.sh

# Pin to a specific contracts sha
scripts/deploy/deploy-contracts.sh --tag 52801a0

# Deploy just one chain (no linking — nothing to link against)
scripts/deploy/deploy-contracts.sh --chains stellar

# Deploy three chains; full-mesh linking
scripts/deploy/deploy-contracts.sh --chains evm,stellar,solana

# Dev iteration — local repo tree + test tokens + emit seed config
scripts/deploy/deploy-contracts.sh \
  --local --with-test-tokens \
  --seed-config-out /tmp/seed.yaml
```

## How chains are discovered

Each entry in `--chains` maps 1:1 to `contracts/<name>/deploy/`. The
orchestrator verifies the directory exists and fails fast if you
reference a chain that hasn't been wired up. Adding a new chain is
"drop a `contracts/<name>/deploy/` package that exposes `cli deploy`,
`cli deploy-test-tokens`, `cli link --peer <path>`" — no orchestrator
edits needed.

## Pieces

- **`fetch-contracts-bundle.sh`** — downloads the Proofbridge-Contracts
  release tarball (or syncs from the local repo tree with `--local`),
  extracts it, and prints shell exports. Shared with
  `scripts/docker-local/up.sh`.
- **`deploy-contracts.sh`** — fetches artifacts, deploys each chain in
  `--chains`, optionally deploys test tokens, links every ordered pair,
  and (optionally) emits a seed config.

## Flags

| Flag | Purpose |
|---|---|
| `--chains <names>` | Comma-separated chain list. Default: `evm,stellar`. |
| `--tag <sha\|latest>` | Bundle tag to pull. Also read from `$CONTRACTS_BUNDLE_TAG`. Defaults to `latest`. |
| `--local` | Use the local repo tree; skips the bundle download. Dev-only. |
| `--no-fetch` | Skip the bundle step; caller must already have `EVM_OUT_DIR` / `STELLAR_WASM_DIR` / `STELLAR_DEPOSIT_VK` set (used by docker-local). |
| `--with-test-tokens` | Also run `deploy-test-tokens` on each chain. Never use in prod. |
| `--skip-link` | Deploy without running the `link` step. Auto-skipped when only 1 chain is deployed. |
| `--evm-env <file>` | `source` before EVM steps. |
| `--stellar-env <file>` | `source` before Stellar steps. |
| `--seed-config-out <path>` | Emit a `seed.config.yaml` listing every deployed chain's manifest. Consumed by `pnpm --filter backend-relayer run seed:dev --config <path>`. |
| `--admin-email <email>` | Seed-config admin email. Default: `$ADMIN_EMAIL` or `admin@x.com`. |
| `--admin-password <pw>` | Seed-config admin password. Default: `$ADMIN_PASSWORD` or `ChangeMe123!`. |

## Env reference

Driven by the env each per-chain CLI expects. Most important:

| Variable | Required by | Purpose |
|---|---|---|
| `EVM_RPC_URL` | EVM | JSON-RPC endpoint |
| `EVM_ADMIN_PRIVATE_KEY` | EVM | Deployer + initial admin |
| `STELLAR_NETWORK` | Stellar | `stellar network` profile name |
| `STELLAR_SOURCE_ACCOUNT` | Stellar | `stellar keys` identity |
| `DEPLOY_ENV` | both | Stamped into manifest `meta.env` |
| `GIT_COMMIT` | both | Auto-filled from `git rev-parse --short HEAD` if unset |
| `CONTRACTS_BUNDLE_DIR` | bundle fetcher | Where to extract the bundle (default: `scripts/deploy/.bundle`) |

See `contracts/<chain>/deploy/README.md` for the full per-chain env lists.

## After deploying

If you passed `--seed-config-out`, feed it directly to the relayer:

```bash
pnpm --filter backend-relayer run seed:dev --config /tmp/seed.yaml
```

Otherwise, point at the manifests yourself in
`apps/backend-relayer/seed.config.yaml` (one entry per chain).
