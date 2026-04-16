"use client"
import Cookies from "js-cookie"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAccount, useDisconnect } from "wagmi"
import { useEvmLogin } from "@/hooks/useEvmAuth"
import type { ChainAdapter, ChainStatus } from "./types"

export const useEvmAdapter = (): ChainAdapter => {
  const { address, isConnected, isConnecting } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const login = useEvmLogin()

  const authed = Boolean(Cookies.get("auth_token"))

  let status: ChainStatus = "disconnected"
  if (isConnecting) status = "connecting"
  else if (isConnected && authed) status = "authenticated"
  else if (isConnected) status = "connected"

  return {
    id: "ethereum",
    name: "Ethereum",
    logo: "/assets/logos/eth.svg",
    address: address ?? null,
    status,
    connect: () => openConnectModal?.(),
    disconnect: () => {
      disconnect()
      Cookies.remove("auth_token")
      Cookies.remove("refresh_token")
      window.location.reload()
    },
    signIn: () => login.mutate(),
    isSigningIn: login.isPending,
  }
}
