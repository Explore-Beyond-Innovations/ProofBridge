export type ChainStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "authenticated"

export interface ChainAdapter {
  id: string
  name: string
  logo: string
  address: string | null
  status: ChainStatus
  connect: () => void | Promise<unknown>
  disconnect: () => void | Promise<unknown>
  signIn?: () => void | Promise<unknown>
  isSigningIn?: boolean
}
