"use client"
import { useMutation } from "@tanstack/react-query"
import { useAccount, useSignMessage } from "wagmi"
import { SiweMessage } from "siwe"
import Cookies from "js-cookie"
import { toast } from "sonner"
import { requestChallenge, submitLogin } from "@/services/auth.service"
import { urls } from "@/utils/urls"

/**
 * Runs the full SIWE login dance:
 *   1. wallet must already be connected via wagmi
 *   2. POST /auth/challenge → { nonce }
 *   3. build SiweMessage, prompt wallet signature
 *   4. POST /auth/login → { tokens, user }
 *   5. persist tokens in cookies
 */
export const useEvmLogin = () => {
  const { address, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()

  return useMutation({
    mutationKey: ["evm-siwe-login"],
    mutationFn: async () => {
      if (!address) throw new Error("EVM wallet not connected")
      if (!chainId) throw new Error("No chain selected")

      const challenge = await requestChallenge("EVM", address)
      if (challenge.chainKind !== "EVM") {
        throw new Error("Unexpected challenge kind from backend")
      }

      const message = new SiweMessage({
        domain: urls.SIGN_DOMAIN,
        address,
        statement: "Sign in with Ethereum to ProofBridge.",
        uri: urls.SIGN_URI,
        version: "1",
        chainId,
        nonce: challenge.nonce,
      }).prepareMessage()

      const signature = await signMessageAsync({ message })

      const data = await submitLogin({
        chainKind: "EVM",
        message,
        signature,
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
          "Ethereum sign-in failed",
      )
    },
  })
}
