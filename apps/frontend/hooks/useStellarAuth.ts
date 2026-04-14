"use client"
import { useMutation } from "@tanstack/react-query"
import Cookies from "js-cookie"
import { toast } from "sonner"
import { requestChallenge, submitLogin } from "@/services/auth.service"
import { useStellarWallet } from "@/components/providers/StellarWallet"

/**
 * Runs the full SEP-10 login dance:
 *   1. ensure wallet is connected (returns G-strkey)
 *   2. POST /auth/challenge → server-signed challenge XDR
 *   3. ask wallet to co-sign the XDR
 *   4. POST /auth/login → { tokens, user }
 *   5. persist tokens in cookies
 */
export const useStellarLogin = () => {
  const { address, connect, signTransaction, networkPassphrase } =
    useStellarWallet()

  return useMutation({
    mutationKey: ["stellar-sep10-login"],
    mutationFn: async () => {
      const accountId = address ?? (await connect())
      if (!accountId) throw new Error("Stellar wallet not connected")

      const challenge = await requestChallenge("STELLAR", accountId)
      if (challenge.chainKind !== "STELLAR") {
        throw new Error("Unexpected challenge kind from backend")
      }

      const signedXdr = await signTransaction(
        challenge.transaction,
        challenge.networkPassphrase ?? networkPassphrase,
      )

      const data = await submitLogin({
        chainKind: "STELLAR",
        transaction: signedXdr,
      })

      Cookies.set("auth_token", data.tokens.access)
      Cookies.set("refresh_token", data.tokens.refresh)
      window.location.reload()
      return data
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Stellar sign-in failed",
      )
    },
  })
}
