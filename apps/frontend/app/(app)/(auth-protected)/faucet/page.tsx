"use client"

import React, { useState } from "react"
import { Button, message, Spin } from "antd"
import { useGetAllChains } from "@/hooks/useChains"
import { useGetAllTokens } from "@/hooks/useTokens"
import { GiWaterDrop } from "react-icons/gi"
import useFaucet from "@/hooks/useFaucet"
import { IToken } from "@/types/tokens"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { IChain } from "@/types/chains"

const TokenList: React.FC<{ chainId: string; chainName?: string }> = ({
  chainId,
  chainName,
}) => {
  const { data: tokens, isLoading } = useGetAllTokens({ chainId })
  const [claiming, setClaiming] = useState<Record<string, boolean>>({})
  const { mutateAsync, isPending } = useFaucet()

  const { openConnectModal } = useConnectModal()
  const { address } = useAccount()

  const handleClaim = async (token: IToken) => {
    const key = token.id || `${token.symbol}-${token.address}`
    setClaiming((s) => ({ ...s, [key]: true }))
    try {
      await mutateAsync({ tokenId: token.id })
      message.success(`Requested ${token.symbol} on ${chainName || chainId}`)
    } catch (err) {
      // error handled by hook/toast
    } finally {
      setClaiming((s) => ({ ...s, [key]: false }))
    }
  }

  if (isLoading)
    return (
      <div className="p-4 flex items-center justify-center">
        <Spin />
      </div>
    )

  if (!tokens?.data || tokens.data.length === 0)
    return (
      <div className="p-4 text-center text-grey-400">
        No tokens on this chain
      </div>
    )

  return (
    <div className="space-y-3">
      {tokens.data.map((token: IToken) => {
        const key = token.id || `${token.symbol}-${token.address}`

        return (
          <div
            key={key}
            className="flex items-center justify-between flex-wrap gap-4 p-3 bg-grey-900 rounded-md border border-grey-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-grey-800 flex items-center justify-center text-amber-300">
                {token.symbol?.[0] || token.name?.[0] || "T"}
              </div>
              <div>
                <div className="font-semibold">
                  {token.name || token.symbol}
                </div>
                <div className="text-xs text-grey-400">{token.symbol}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!address ? (
                <Button type="primary" onClick={() => openConnectModal?.()}>
                  Connect Wallet
                </Button>
              ) : (
                <>
                  <Button
                    type="primary"
                    onClick={() => handleClaim(token)}
                    loading={!!claiming[key]}
                    title={`Make sure your wallet is set to ${
                      chainName || chainId
                    } before claiming`}
                  >
                    Claim
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const FaucetPage: React.FC = () => {
  const { data: chainsData, isLoading } = useGetAllChains({ limit: 20 })

  const chains = chainsData?.data || []
  const firstTwo = chains.slice(0, 2)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
          <GiWaterDrop size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Faucet</h1>
          <p className="text-sm text-grey-400">
            Claim test tokens for supported chains. Select a chain and claim
            tokens below.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="p-6 flex items-center justify-center">
            <Spin />
          </div>
        ) : firstTwo.length === 0 ? (
          <div className="p-6 text-center text-grey-400">
            No chains available for faucet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {firstTwo.map((chain: IChain) => (
              <div
                key={chain.chainId}
                className="bg-grey-900 p-4 rounded-md border border-grey-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-semibold">{chain.name}</div>
                    <div className="text-xs text-grey-400">{chain.chainId}</div>
                  </div>
                  <div className="text-xs text-grey-300">Testnet</div>
                </div>

                <TokenList chainId={chain.chainId} chainName={chain.name} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FaucetPage
