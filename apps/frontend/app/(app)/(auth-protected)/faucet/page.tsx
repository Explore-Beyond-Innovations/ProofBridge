"use client"

import React, { useState } from "react"
import { App, Button, Spin, Tooltip } from "antd"
import { useGetAllChains } from "@/hooks/useChains"
import { useGetAllTokens } from "@/hooks/useTokens"
import { GiWaterDrop } from "react-icons/gi"
import useFaucet from "@/hooks/useFaucet"
import { IToken } from "@/types/tokens"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAccount, useSwitchChain, useWalletClient, useConfig } from "wagmi"
import { getWalletClient } from "wagmi/actions"
import { IChain } from "@/types/chains"
import { useStellarWallet } from "@/components/providers/StellarWallet"
import { hex32ToContractId } from "@/utils/stellar/address"
import { WalletMinimal } from "lucide-react"
import { addToken as freighterAddToken } from "@stellar/freighter-api"

const TokenList: React.FC<{ chainId: string; chainName?: string }> = ({
  chainId,
  chainName,
}) => {
  const { data: tokens, isLoading } = useGetAllTokens({ chainId })
  const [claiming, setClaiming] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const { mutateAsync } = useFaucet()

  const { openConnectModal } = useConnectModal()
  const { address: evmAddress } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const wagmiConfig = useConfig()
  const {
    address: stellarAddress,
    connect: connectStellar,
    networkPassphrase: stellarNetworkPassphrase,
  } = useStellarWallet()
  const { message } = App.useApp()

  const isEvmChain = (token: IToken) => token.chain.kind === "EVM"
  const isStellarChain = (token: IToken) => token.chain.kind === "STELLAR"
  const connectedForToken = (token: IToken) =>
    isEvmChain(token) ? !!evmAddress : isStellarChain(token) && !!stellarAddress

  const addTooltip = (token: IToken): string | null => {
    if (isEvmChain(token) && token.kind === "ERC20") {
      return `Add ${token.symbol} to wallet`
    }
    if (isStellarChain(token) && (token.kind === "SAC" || token.kind === "SEP41")) {
      return `Add ${token.symbol} to Freighter`
    }
    return null
  }

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

  const handleAddToWallet = async (token: IToken) => {
    const key = token.id || `${token.symbol}-${token.address}`
    setAdding((s) => ({ ...s, [key]: true }))
    try {
      if (isEvmChain(token) && token.kind === "ERC20") {
        if (!evmAddress) {
          message.error("Connect an EVM wallet first")
          return
        }
        const targetChainId = Number(token.chain.chainId)

        if (walletClient?.chain.id !== targetChainId) {
          await switchChainAsync({ chainId: targetChainId })
        }
        const wc = await getWalletClient(wagmiConfig, {
          chainId: targetChainId,
        })
        if (!wc) {
          message.error("Connect an EVM wallet first")
          return
        }
        await wc.watchAsset({
          type: "ERC20",
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          },
        })
        message.success(`${token.symbol} added to wallet`)
        return
      }
      if (
        isStellarChain(token) &&
        (token.kind === "SAC" || token.kind === "SEP41")
      ) {
        if (!stellarAddress) {
          message.error("Connect a Stellar wallet first")
          return
        }
        const contractId = hex32ToContractId(token.address)
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const res = await Promise.race([
          freighterAddToken({
            contractId,
            networkPassphrase: stellarNetworkPassphrase,
          }),
          new Promise<{ contractId: string; error: { message: string } }>(
            (resolve) => {
              timeoutId = setTimeout(
                () =>
                  resolve({
                    contractId: "",
                    error: { message: "Freighter did not respond in time" },
                  }),
                30_000,
              )
            },
          ),
        ]).finally(() => {
          if (timeoutId) clearTimeout(timeoutId)
        })
        if (res.error) {
          try {
            await navigator.clipboard.writeText(contractId)
            message.success(
              `Copied ${token.symbol} contract — paste it in your wallet's Add Asset search`,
            )
          } catch {
            message.warning(
              `Couldn't add to Freighter or copy automatically. Contract: ${contractId}`,
            )
          }
        } else {
          message.success(`${token.symbol} added to Freighter`)
        }
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Failed to add token to wallet",
      )
    } finally {
      setAdding((s) => ({ ...s, [key]: false }))
    }
  }

  const claimable =
    tokens?.data?.filter(
      (t) => t.kind !== "NATIVE" && t.symbol.toUpperCase() !== "XLM",
    ) ?? []

  if (isLoading)
    return (
      <div className="p-4 flex items-center justify-center">
        <Spin />
      </div>
    )

  if (claimable.length === 0)
    return (
      <div className="p-4 text-center text-grey-400">
        No tokens on this chain
      </div>
    )

  return (
    <div className="space-y-3">
      {claimable.map((token: IToken) => {
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

            <div className="flex items-center gap-2">
              {!connectedForToken(token) ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() =>
                    isStellarChain(token)
                      ? connectStellar()
                      : openConnectModal?.()
                  }
                >
                  Connect
                </Button>
              ) : (
                <>
                  {addTooltip(token) && (
                    <Tooltip title={addTooltip(token)}>
                      <Button
                        size="small"
                        shape="circle"
                        icon={<WalletMinimal size={14} />}
                        onClick={() => handleAddToWallet(token)}
                        loading={!!adding[key]}
                      />
                    </Tooltip>
                  )}
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleClaim(token)}
                    loading={!!claiming[key]}
                    title={`Make sure your wallet is set to ${chainName || chainId
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
