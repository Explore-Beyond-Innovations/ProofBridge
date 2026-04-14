# docker-local

Single-command local stack for frontend development. Starts anvil + stellar
quickstart + postgres, deploys the EVM and Soroban contracts, seeds the
relayer DB with chains/tokens/routes, and runs `backend-relayer` on
`http://localhost:2005` — no host toolchain beyond Docker.

## Requirements

- Docker 24+ with compose v2
- `curl` (used by `up.sh` to fetch the contracts bundle)

No rust / foundry / nargo / stellar CLI needed on the host — contract
artifacts are downloaded from the public Proofbridge-Contracts `latest` GitHub Release
and bind-mounted into the deployer container.

## Usage

```bash
bash scripts/docker-local/up.sh        # pull artifacts + start everything
bash scripts/docker-local/down.sh      # stop (keeps postgres + deploy snapshot)
bash scripts/docker-local/down.sh -r   # stop + wipe volumes for a fresh deploy
```

First run downloads a ~few-MB tarball and builds the deployer image
(~1 min). Subsequent `up`s reuse both, so cold-start drops to ~20-30s.

### Funding your dev wallets

Export your frontend-dev addresses before running `up.sh` — the deployer
will top up native balance + mint test tokens on the respective chains:

```bash
export DEV_EVM_ADDRESS=0xYourMetaMaskAddress
export DEV_STELLAR_ADDRESS=GYOURSTELLAR...
bash scripts/docker-local/up.sh
```

Or drop them into `scripts/docker-local/.env` (docker-compose auto-loads
that file):

```text
DEV_EVM_ADDRESS=0x...
DEV_STELLAR_ADDRESS=G...
```

What you get on first successful deploy:

- **EVM**: 100 ETH on anvil (via `anvil_setBalance`) + 1,000,000 TT (the
  `ERC20Mock` test token) minted to the dev address
- **Stellar**: friendbot-funded G-address (~10k XLM on the local
  quickstart)

Leaving either variable unset skips that chain. Reruns are idempotent:
`anvil_setBalance` overwrites and friendbot swallows
`op_already_exists`.

### Pinning a specific build

`up.sh` defaults to the rolling `latest` tag on the Proofbridge-Contracts
release, which is updated by `.github/workflows/contracts-release.yml` on
every push to `main`. To pin a specific commit's artifacts:

```bash
CONTRACTS_BUNDLE_TAG=<short-sha> bash scripts/docker-local/up.sh
```

Every `main` build also publishes an immutable `<short-sha>` release,
so bisecting regressions is cheap.

### Iterating on contracts locally

If you're actively editing contracts / circuits and have the toolchains
installed, skip the download and bind-mount your repo's own build tree:

```bash
# build the pieces you changed
pushd contracts/stellar && stellar contract build && popd
pushd contracts/evm    && forge build --silent      && popd
scripts/build_circuits.sh proof_circuits/deposits

# then start the stack pointed at your tree
bash scripts/docker-local/up.sh --local
```

`--local` copies from `contracts/stellar/target/...`, `contracts/evm/out`,
and `proof_circuits/deposits/target/vk` into `.artifacts/` and bails out
early if anything is missing.

Exposed ports:

| Service  | Host URL                                            |
| -------- | --------------------------------------------------- |
| relayer  | <http://localhost:2005>                             |
| postgres | postgresql://relayer:relayer@localhost:5433/relayer |
| anvil    | <http://localhost:9545> (chain id 31337)            |
| stellar  | <http://localhost:8000> (soroban RPC: /soroban/rpc) |

## Point the frontend at it

The Next.js app in `apps/frontend` reads the relayer URL from its usual
environment variables. For local dev:

```text
NEXT_PUBLIC_RELAYER_URL=http://localhost:2005
```

Chain RPCs seeded into the DB point at the in-compose hostnames (`anvil`,
`stellar`), which are unreachable from the browser. The frontend talks
only to the relayer; direct wallet→chain traffic goes through the wallet
provider (wagmi for EVM, stellar-wallets-kit for Stellar) using the host
URLs above.

## What's inside

- `docker-compose.yaml` — the stack definition; bind-mounts `.artifacts/`
  into the deployer at the paths `deploy.ts` reads
- `Dockerfile.deployer` — slim runtime image (node + pnpm + stellar CLI
  for `contract deploy`/`invoke`). No rust/foundry — contracts are
  built in CI, not here.
- `entrypoint.sh` — runs inside the deployer: verifies artifacts are
  mounted, configures stellar network, generates + friendbot-funds the
  admin identity, deploys contracts, runs prisma migrations, seeds the
  DB, writes the admin secret to a shared volume
- `up.sh` / `down.sh` — convenience wrappers; `up.sh` fetches the
  contracts bundle before invoking compose
- `.artifacts/` (gitignored) — extracted contracts bundle

## Notes

- The Stellar admin secret is generated fresh on every full `up --build`
  (anvil + stellar are ephemeral), written to a docker volume, and read
  by the relayer at start. `down -r` clears it; plain `down` keeps it.
- To refresh artifacts without touching containers: delete `.artifacts/`
  and re-run `up.sh`, or set `CONTRACTS_BUNDLE_TAG=latest` explicitly
  to force a download.
- The relayer image reuses `apps/backend-relayer/Dockerfile` — the same
  one the CI e2e and production builds use.
