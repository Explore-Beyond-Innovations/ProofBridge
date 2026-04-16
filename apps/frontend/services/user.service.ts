import { api } from "./api.instance"
import type { ChainKind } from "./auth.service"

export interface IUserWallet {
  address: string
  chainKind: ChainKind
  createdAt: string
}

export interface ICurrentUser {
  id: string
  username: string
  createdAt: string
  updatedAt: string
  wallets: IUserWallet[]
}

export const getCurrentUser = async (): Promise<ICurrentUser> => {
  const res = await api.get("/v1/user/me")
  return res.data as ICurrentUser
}
