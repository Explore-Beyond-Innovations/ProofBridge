"use client"
import Cookies from "js-cookie"
import { useStellarWallet } from "@/components/providers/StellarWallet"
import { useStellarLogin } from "@/hooks/useStellarAuth"
import type { ChainAdapter, ChainStatus } from "./types"

export const useStellarAdapter = (): ChainAdapter => {
  const { address, connect, disconnect, isConnecting } = useStellarWallet()
  const login = useStellarLogin()

  const authed = Boolean(Cookies.get("auth_token"))

  let status: ChainStatus = "disconnected"
  if (isConnecting) status = "connecting"
  else if (address && authed) status = "authenticated"
  else if (address) status = "connected"

  return {
    id: "stellar",
    name: "Stellar",
    logo: "/assets/logos/stellar-logo.svg",
    address,
    status,
    connect,
    disconnect: async () => {
      await disconnect()
      Cookies.remove("auth_token")
      Cookies.remove("refresh_token")
      window.location.reload()
    },
    signIn: () => login.mutate(),
    isSigningIn: login.isPending,
  }
}
