import type { ChainKind } from "@/types/chains"

export type ChainStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "authenticated"

export interface ChainAdapter {
  id: string
  name: string
  logo: string
  /**
   * The on-chain family this adapter speaks (EVM, STELLAR, ...). Used to
   * pick the right adapter for an asset whose `chainKind` is known, without
   * having to hardcode adapter ids at the call site.
   */
  chainKind: ChainKind
  address: string | null
  status: ChainStatus
  /**
   * True when a JWT session already exists for a different wallet and this
   * wallet still needs to be attached to the same user via `/auth/link`.
   * Drives the "Link wallet" vs "Sign in" button label.
   */
  requiresLink?: boolean
  connect: () => void | Promise<unknown>
  disconnect: () => void | Promise<unknown>
  signIn?: () => void | Promise<unknown>
  isSigningIn?: boolean
}
