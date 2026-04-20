"use client"

import { useMutation, UseMutationOptions } from "@tanstack/react-query"
import { api } from "@/services/api.instance"
import { urls } from "@/utils/urls"
import axios from "axios"
import { toast } from "sonner"

export interface FaucetRequest {
  tokenId: string
}

export interface FaucetResponse {
  txHash: string
  symbol: string
  chainId: string
  amount: string
}

const faucet_route = (path = "") => `${urls.API_URL}/v1/faucet${path}`

const requestFaucet = async (body: FaucetRequest): Promise<FaucetResponse> => {
  const resp = await api.post(faucet_route("/request"), body)
  return resp.data as FaucetResponse
}

/**
 * useFaucet hook
 * Usage:
 * const { mutateAsync, isLoading } = useFaucet({ onSuccess, onError })
 * await mutateAsync({ tokenId: "..." })
 */
export const useFaucet = () => {
  return useMutation({
    mutationFn: (payload: FaucetRequest) => requestFaucet(payload),
    onSuccess: () => {
      toast.success("Claim was successful")
    },
    onError: (error: unknown) => {
      const e = error as {
        response?: { data?: { message?: unknown }; status?: number }
        code?: string
        message?: string
      }
      const serverMsg =
        typeof e.response?.data?.message === "string"
          ? e.response.data.message
          : null
      const msg =
        serverMsg ||
        (e.code ? `${e.code}: ${e.message ?? "request failed"}` : null) ||
        e.message ||
        "Unable to request tokens"
      toast.error(msg)
    },
  })
}

export default useFaucet
