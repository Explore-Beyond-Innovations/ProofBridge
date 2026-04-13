"use client"
import React, { useEffect, useState } from "react"
import {
  Alert,
  Button,
  Divider,
  Select,
  Skeleton,
  Tooltip,
} from "antd"
import { ArrowRight, Bot, Clock, Rabbit, Verified } from "lucide-react"
import Image from "next/image"
import { TradeAd } from "./TradeAd"
import { SellAd } from "./SellAdd"
import { useGetAllChains } from "@/hooks/useChains"
import { IChain } from "@/types/chains"
import { useGetAllTokens } from "@/hooks/useTokens"
import { useGetAllAds } from "@/hooks/useAds"
import { GiChainLightning } from "react-icons/gi"
import SkeletonTradeAd from "./SkeletonTradeAd"
import { sepolia } from "viem/chains"
import { chain_icons } from "@/lib/chain-icons"
import { isVisibleChain, STELLAR_TESTNET_CHAIN_ID } from "@/lib/chains"
import { IoDocumentText } from "react-icons/io5"
import { Logo } from "../shared/Logo"

export const BridgeTab = () => {
  const { data: chains, isLoading: loadingChains } = useGetAllChains({})

  const [selectedBaseChainId, setSelectedBaseChainId] = useState<string>(
    STELLAR_TESTNET_CHAIN_ID
  )
  const [selectedDstChainId, setSelectedDstChainId] = useState<string>(
    `${sepolia.id}`
  )
  const [selectedTokenId, setSelectedTokenId] = useState<string>("")

  const { data: tokens, isLoading: loadingTokens } = useGetAllTokens({
    chainId: selectedBaseChainId,
  })

  const { data: Ads, isLoading: loadingAds } = useGetAllAds({
    limit: 20,
    status: "ACTIVE",
    orderChainId: selectedBaseChainId,
    adChainId: selectedDstChainId,
    orderTokenId: selectedTokenId,
  })
  // useEffect(() => {
  //   if (chains?.rows.length) {
  //     setSelectedBaseChainId(chains.rows[0].chainId)
  //   }
  // }, [chains])

  useEffect(() => {
    if (tokens?.data.length) {
      setSelectedTokenId(tokens.data[0].id)
    }
  }, [tokens])
  return (
    <div className="w-full bg-grey-900 p-4 md:p-6 rounded-md space-y-4 md:space-y-6 tracking-wider">
      <div className="">
        <div className="flex items-center gap-7 mb-2">
          <div className="flex items-center gap-2 w-[200px]">
            <GiChainLightning />
            <p className="text-sm">From Chain</p>
          </div>
          <div className="flex items-center gap-2 w-50">
            <GiChainLightning />
            <p className="text-sm">To Chain</p>
          </div>
        </div>
        <div className="flex md:flex-row flex-col md:items-center gap-4">
          <div className="inline-flex items-center gap-2 bg-grey-800 p-1.25 rounded-sm w-fit">
            {loadingChains ? (
              <>
                <Skeleton.Button active={true} />
                <Skeleton.Button active={true} />
              </>
            ) : (
              <>
                <Select
                  onChange={(id) => setSelectedBaseChainId(id)}
                  className="min-w-[200px] !h-[40px]"
                  value={selectedBaseChainId}
                >
                  {chains?.rows
                    ?.filter((chain) => isVisibleChain(chain.chainId))
                    .map((chain) => {
                      return (
                        <Select.Option key={chain.chainId} value={chain.chainId}>
                          <div className="flex items-center gap-2">
                            <Image
                              src={chain_icons[chain.chainId]}
                              alt=""
                              width={20}
                              height={20}
                            />
                            <span className="text-[13px]">{chain.name}</span>
                          </div>
                        </Select.Option>
                      )
                    })}
                </Select>
                <div>
                  <ArrowRight size={14} />
                </div>
                <Select
                  onChange={(id) => setSelectedDstChainId(id)}
                  className="min-w-[200px] !h-[40px]"
                  value={selectedDstChainId}
                >
                  {chains?.rows
                    ?.filter((chain) => isVisibleChain(chain.chainId))
                    .map((chain) => {
                      return (
                        <Select.Option key={chain.chainId} value={chain.chainId}>
                          <div className="flex items-center gap-2">
                            <Image
                              src={chain_icons[chain.chainId]}
                              alt=""
                              width={20}
                              height={20}
                            />
                            <span className="text-[13px]">{chain.name}</span>
                          </div>
                        </Select.Option>
                      )
                    })}
                </Select>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Divider
              type="vertical"
              className="!h-[25px] !my-0 !py-0 md:!block !hidden"
            />
            <div className="md:flex items-center gap-2 hidden">
              <p className=" text-amber-200">Other chains coming soon.</p>
              <Rabbit className="text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex md:flex-row flex-col md:items-center md:justify-between gap-3">
        <div className="">
          <p>Select token</p>
          <div className="flex items-center gap-3 md:gap-3 text-xs p-2 px-3 bg-grey-1000/50 rounded-sm">
            {loadingTokens ? (
              <Skeleton.Button active={true} />
            ) : (
              <>
                {tokens?.data?.map((token, index) => {
                  const isActive = selectedTokenId === token.id
                  return (
                    <p
                      key={index}
                      className={`${isActive
                        ? "text-black bg-primary px-3 py-2 rounded-sm"
                        : ""
                        } cursor-pointer`}
                      onClick={() => setSelectedTokenId(token.id)}
                    >
                      {token.name}
                    </p>
                  )
                })}
              </>
            )}
          </div>
        </div>

        <Tooltip
          showArrow
          title={"AI assistant coming soon."}
          open
          placement="left"
          color="magenta"
        >
          <Bot size={30} className="text-primary" />
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <IoDocumentText className="text-primary" />
        <p className="text-sm underline">
          {
            chains?.rows?.find((chain) => chain.chainId === selectedBaseChainId)
              ?.name
          }{" "}
          ADs
        </p>
      </div>

      <div className="hidden md:grid [grid-template-columns:2fr_1fr_2fr_1fr_1fr] gap-7 items-center text-grey-400 text-sm font-semibold border-y-1 border-y-grey-800 py-2">
        <p>Advertiser</p>
        <p>Destination chain</p>
        <p>Available | Limits</p>
        <p>Date posted</p>
        <div>
          <Alert
            message={<p className="text-xs md:text-end">Action</p>}
            type="info"
          />
        </div>
      </div>

      <div className="space-y-6" id="#bridge-trading-section">
        {loadingAds ? (
          <>
            {[1, 2, 3, 4, 5].map((value) => {
              return <SkeletonTradeAd key={value} />
            })}
          </>
        ) : Ads?.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-24 w-24 rounded-full bg-grey-800 flex items-center justify-center">
              <div className="opacity-20">
                <Logo />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">No Active Bridges</h3>
              <p className="text-grey-400 max-w-md">
                There are currently no active bridge offers for this route. Try
                selecting different tokens or chains, or check back later.
              </p>
            </div>
            <Button
              type="primary"
              className="mt-4"
              onClick={() => {
                setSelectedBaseChainId(STELLAR_TESTNET_CHAIN_ID)
                setSelectedDstChainId(`${sepolia.id}`)
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <>
            {Ads?.data?.map((ad, index) => (
              <TradeAd key={index} {...ad} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
