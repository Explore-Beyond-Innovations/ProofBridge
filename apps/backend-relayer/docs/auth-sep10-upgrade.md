# Stellar Auth — SEP-10 Upgrade Path

Status: **not implemented** — captured here for a future iteration.

Link: https://developers.stellar.org/docs/build/apps/wallet/sep10

## Where we are today

The relayer already speaks **SEP-10 Layer 1** (the challenge transaction format). What we do **not** expose is the canonical Layer 2 HTTP surface and discovery metadata that third-party Stellar SDKs expect.

Current flow (manual, frontend-driven):

1. `POST /v1/auth/challenge` with `{ chainKind: "STELLAR", address }`
   - Server builds the SEP-10 challenge via `WebAuth.buildChallengeTx` in `StellarAuthService.buildChallenge`.
   - Returns `{ transaction, networkPassphrase, address, expiresAt }`.
2. Frontend hands the XDR to the user's wallet (Freighter, Albedo, Lobstr, wallet-kit, etc.) and asks it to co-sign.
3. `POST /v1/auth/login` with `{ chainKind: "STELLAR", transaction: <signed XDR> }`
   - Server verifies with `WebAuth.readChallengeTx` + `WebAuth.verifyChallengeTxSigners`, records the tx hash in `AuthNonce` for replay protection, upserts the user, returns JWTs.

This is sufficient for our own frontend because it owns both sides of the fetch. It is **not** sufficient for SDKs that expect to auto-discover the auth endpoint.

## What canonical SEP-10 Layer 2 looks like

Two HTTP endpoints, both commonly mounted at `/auth` on the server's public domain:

- `GET /auth?account=<G...>&home_domain=<host>&client_domain=<host>` → `{ transaction, network_passphrase }`
- `POST /auth` with `{ transaction, client_domain? }` → `{ token }`

Plus a discovery document:

- `GET /.well-known/stellar.toml` exposing at minimum:
  ```toml
  NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
  WEB_AUTH_ENDPOINT  = "https://api.proofbridge.xyz/v1/auth/sep10"
  SIGNING_KEY        = "G... (public key of STELLAR_AUTH_SECRET)"
  ACCOUNTS           = ["G..."]  # same as SIGNING_KEY, for SDKs that look here
  ```

With those in place, a caller can do:

```ts
const anchor = wallet.anchor({ homeDomain: 'proofbridge.xyz' });
const auth   = await anchor.sep10();
const token  = await auth.authenticate({ accountKp });
```

…and the SDK handles the GET/POST dance itself. No bespoke frontend code required.

## Trigger for the upgrade

Adopt Layer 2 when **any** of these becomes true:

- A third-party client (partner integration, wallet-kit flow) needs to authenticate against the relayer without hand-rolling the fetch.
- We publish a public SDK that wraps the relayer and want it to be drop-in with the Stellar ecosystem's expectations.
- We add `client_domain` attribution (proving *which* app/dapp is logging the user in, not just which wallet).

Until then, manual fetch is fine and avoids the TOML operational overhead.

## Implementation sketch

Nothing about `StellarAuthService` needs to change — its `buildChallenge` / `verifyLogin` are already the right primitives. The upgrade is purely a thin HTTP layer.

1. **New controller** `sep10.controller.ts`:
   ```ts
   @Controller('/v1/auth/sep10')
   export class Sep10Controller {
     constructor(private readonly stellarAuth: StellarAuthService,
                 private readonly auth: AuthService) {}

     @Get()
     get(@Query('account') account: string,
         @Query('home_domain') homeDomain?: string,
         @Query('client_domain') clientDomain?: string) {
       const { transaction, networkPassphrase } =
         this.stellarAuth.buildChallenge(account, { homeDomain, clientDomain });
       return { transaction, network_passphrase: networkPassphrase };
     }

     @Post()
     async post(@Body() body: { transaction: string; client_domain?: string }) {
       const user = await this.stellarAuth.verifyLogin(body.transaction, {
         clientDomain: body.client_domain,
       });
       const { tokens } = await this.auth.issueTokensForUser(user);
       return { token: tokens.access };  // SEP-10 returns a single JWT
     }
   }
   ```
   Note the response shape: `{ token }` (singular, access only). Refresh is not part of SEP-10 — clients re-auth when it expires. Our existing `/v1/auth/login` can keep returning the `{ access, refresh }` pair for our own frontend.

2. **stellar.toml controller** serving `GET /.well-known/stellar.toml` as `text/plain`. Values come from `env.stellar.authSecret` (public key derived once at boot) and `env.stellar.networkPassphrase`.

3. **Optional `client_domain` support** in `StellarAuthService.buildChallenge`:
   - Add a second ManageData op with key `client_domain` and value = the requested domain.
   - On verify, fetch `https://<client_domain>/.well-known/stellar.toml`, resolve its `SIGNING_KEY`, and require that key to co-sign the challenge alongside the user.
   - Lean on `StellarTomlResolver` from `@stellar/stellar-sdk` — no need to roll our own fetch.

4. **Replay protection** stays as-is (tx-hash → `AuthNonce`). The challenge format change does not affect uniqueness.

5. **Tests**: extend `stellar-auth.service.spec.ts` with a `clientDomain` branch; add a controller spec for `sep10.controller.ts` mirroring `auth.controller.spec.ts` shape.

## Non-goals

- We are **not** becoming an anchor. SEP-10 is the only Stellar SEP we plan to speak; SEP-6/24/31 etc. are out of scope.
- We are **not** deprecating `/v1/auth/login` when Layer 2 lands. The two coexist: `/sep10` for ecosystem tooling, `/login` for our own frontend's richer `{ user, tokens }` response.

## References

- SEP-10: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
- `@stellar/stellar-sdk` `WebAuth` helpers (already used in `StellarAuthService`).
- `@stellar/typescript-wallet-sdk` — the SDK most likely to exercise Layer 2 against us.
