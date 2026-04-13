"use client"
import {
  createAuthenticationAdapter,
  darkTheme,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit"
import React, { useMemo } from "react"
import { SiweMessage } from "siwe"
import { useAccount } from "wagmi"
import Cookies from "js-cookie"
import { urls } from "@/utils/urls"
import { requestChallenge, submitLogin } from "@/services/auth.service"

function useAuthenticationAdapter() {
  // If the user is logged in but the account is different (e.g. they changed account in Metamask), log them out and reload the page.
  const account = useAccount()

  return useMemo(() => {
    return createAuthenticationAdapter({
      getNonce: async () => {
        const res = await requestChallenge("EVM", account.address ?? "")
        if (res.chainKind !== "EVM") {
          throw new Error("Unexpected challenge kind")
        }
        return res.nonce
      },
      createMessage: ({ nonce, address, chainId }) => {
        return new SiweMessage({
          domain: urls.SIGN_DOMAIN,
          address,
          statement: "Sign in with Ethereum to the app.",
          uri: urls.SIGN_URI,
          version: "1",
          chainId,
          nonce,
        }).prepareMessage()
      },

      verify: async ({ message, signature }) => {
        try {
          const data = await submitLogin({
            chainKind: "EVM",
            message,
            signature,
          })
          Cookies.set("auth_token", data.tokens.access)
          Cookies.set("refresh_token", data.tokens.refresh)
          window.location.reload()
          return true
        } catch {
          return false
        }
      },
      signOut: async () => {
        Cookies.remove("auth_token")
        Cookies.remove("refresh_token")
        window.location.reload()
      },
    })
  }, [account])
}

export const RainbowKit = ({ children }: { children: React.ReactNode }) => {
  const adapter = useAuthenticationAdapter()
  const token = Cookies.get("auth_token")

  return (
    <RainbowKitAuthenticationProvider
      adapter={adapter}
      status={token ? "authenticated" : "unauthenticated"}
    >
      <RainbowKitProvider
        theme={darkTheme({
          accentColor: "#c3ff49",
          accentColorForeground: "#000",
        })}
      >
        {children}
      </RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  )
}
