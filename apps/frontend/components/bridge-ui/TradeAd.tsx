"use client"
import React, { useEffect, useState } from "react"
import { Avatar, Button, Modal, Skeleton } from "antd"
import { ArrowRight, Clock, Info, ThumbsUp, Verified } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { AdStatusT, IAd } from "@/types/ads"
import { formatUnits, parseUnits } from "viem"
import { parseToBigInt } from "@/lib/parse-to-bigint"
import { chains } from "@/lib/chains"
import moment from "moment"
import { truncateString } from "@/utils/truncate-string"
import { formatChainAddress } from "@/utils/format-address"
import { Status } from "../shared/Status"
import { chain_icons } from "@/lib/chain-icons"
import { useAccount, useBalance } from "wagmi"
import { useCreateTrade } from "@/hooks/useTrades"
import { useChainModal } from "@rainbow-me/rainbowkit"

export const TradeAd = ({ ...props }: IAd) => {
  const [openModal, setOpenModal] = useState(false)
  const toggleModal = () => setOpenModal(!openModal)
  const available_tokens = formatUnits(
    parseToBigInt(props.availableAmount),
    props.orderToken.decimals
  )
  const minAmount = formatUnits(
    parseToBigInt(props.minAmount),
    props.orderToken.decimals
  )
  const maxAmount = formatUnits(
    parseToBigInt(props.maxAmount),
    props.orderToken.decimals
  )
  const tokenSymbol = props.orderToken.symbol
  const token = props.orderToken.name
  // const crossChain = chains[props.orderToken.chainId]
  const txFeePercent = 1
  const [amount, setAmount] = useState("")
  const txFee = Number(amount) * (txFeePercent / 100)
  const account = useAccount()
  const nativeBalance = useBalance({
    chainId: Number(props.orderToken.chainId),
    address: account.address,
  })
  const balance = useBalance({
    chainId: Number(props.orderToken.chainId),
    token: props.orderToken.address,
    address: account.address,
  })
  const [balance_value, setBalance_value] = useState("")

  useEffect(() => {
    if (balance.data) {
      setBalance_value(
        formatUnits(balance?.data?.value!, balance?.data?.decimals!)
      )
    } else if (nativeBalance.data) {
      setBalance_value(
        formatUnits(nativeBalance?.data?.value!, nativeBalance?.data?.decimals!)
      )
    }
  }, [balance, nativeBalance, props])

  useEffect(() => {

  }, [nativeBalance, props])

  const { mutateAsync, isPending } = useCreateTrade()
  const { openChainModal } = useChainModal()

  const handleCreateTrade = async () => {
    await mutateAsync({
      payload: {
        adId: props.id,
        routeId: props.routeId,
        amount: parseUnits(amount, props.orderToken.decimals).toString(),
        bridgerDstAddress: account.address!,
      },
      orderTokenId: props.orderTokenId,
    })
    toggleModal()
  }
  return (
    <div>
      <Modal
        forceRender
        open={openModal}
        onCancel={toggleModal}
        centered
        footer={null}
        closeIcon={null}
        width={800}
        styles={{
          content: { padding: 0, borderRadius: "12px" },
          mask: { backdropFilter: "blur(12px)" },
        }}
      >
        <div className="grid md:[grid-template-columns:370px_1fr]">
          <div className="bg-grey-800 w-full h-full md:rounded-l-[12px] p-4 md:p-6 md:py-7 space-y-7">
            <div className="space-y-3">
              <MerchantInfo {...props} variant="variant_2" />
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Verified className="" size={12} />
                  <p className="">Email</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary">
                  <ThumbsUp className="" size={12} />
                  <p className="">Positive feedbacks</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Verified className="" size={12} />
                  <p className="">Verified</p>
                </div>
              </div>
            </div>

            <div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Quantity
                  </p>
                  <p>
                    {Number(available_tokens).toLocaleString()} {tokenSymbol}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Limits
                  </p>
                  <p>
                    {Number(minAmount).toLocaleString()} -{" "}
                    {Number(maxAmount).toLocaleString()} {tokenSymbol}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Route
                  </p>
                  <div className="flex items-center gap-2">
                    <p>{chains[props.orderToken.chainId].name}</p>
                    <ArrowRight size={15} className="text-yellow-500" />
                    <p>{chains[props.adToken.chainId].name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Posted
                  </p>
                  <div className="flex items-center gap-1 text-grey-300">
                    <div className="flex items-center gap-1">
                      <span className=" h-3 w-1 bg-primary"></span>
                      <p>{moment(props.updatedAt).format("LL")}</p>
                    </div>
                    <p>{moment(props.updatedAt).format("LT")}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[13px] tracking-wide text-grey-300">
              <p className="font-semibold mb-1">Advertiser Terms</p>
              <div className="grid [grid-template-columns:12px_1fr] gap-0">
                <Info size={12} className="mt-1" />
                <div className="">
                  <p className="pl-3">
                    Merchants may impose additional terms in the Advertiser
                    Terms. Kindly read carefully before placing an order. In the
                    event of any conflict, the Platform&apos;s{" "}
                    <Link href={"#"} className="!text-primary">
                      Terms
                    </Link>{" "}
                    shall prevail. Violations will not be covered by platform
                    protection.
                  </p>
                  <div className="max-h-[130px] overflow-y-auto mt-2 py-2 pr-2 text-grey-50">
                    <p>{props.metadata.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-grey-800/60 w-full h-full md:rounded-r-[12px] p-4 md:p-6 md:py-7 space-y-3">
            <div className="flex items-center gap-4">
              <p>{chains[props.orderToken.chainId]?.name} balance</p>
              <p className="font-semibold text-primary font-pixter tracking-wide">
                {balance.isLoading || nativeBalance.isLoading ? (
                  <Skeleton.Button active />
                ) : (
                  <>
                    {Number(balance_value).toLocaleString()}{" "}
                    {balance?.data?.symbol || nativeBalance?.data?.symbol}
                  </>
                )}
              </p>
            </div>

            <div className="mb-16 space-y-4">
              <div className="h-[80px] w-full bg-grey-900/40 rounded-md p-4 flex flex-col justify-between">
                <p className="text-xs text-grey-300">Amount to Bridge?</p>
                <div className="grid [grid-template-columns:20px_1fr_20%] gap-1 items-center">
                  <Image
                    src={chain_icons[props.adToken.chainId]}
                    alt=""
                    height={20}
                    width={20}
                    className="rounded-full"
                  />
                  <input
                    className="w-full !border-0 outline-0 text-lg font-semibold tracking-wider disabled:cursor-not-allowed"
                    type="number"
                    onChange={(e) => setAmount(e.target.value)}
                    value={amount}
                    disabled={balance.isLoading || nativeBalance.isLoading}
                  />
                  <p className="text-[11px] space-x-2">
                    <span>{tokenSymbol}</span>{" "}
                    <span className="text-[10px]">|</span>{" "}
                    <span
                      className="cursor-pointer text-primary"
                      role="button"
                      onClick={() => {
                        setAmount(
                          formatUnits(
                            balance?.data?.value!,
                            balance?.data?.decimals!
                          )
                        )
                      }}
                    >
                      All
                    </span>
                  </p>
                </div>
                {Number(balance_value) < Number(amount) && (
                  <p className="text-red-400 my-1">
                    Insuffient funds in wallet
                  </p>
                )}
              </div>
              {amount && (
                <div className="w-full bg-grey-900/40 rounded-md p-4 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between w-full">
                    <p>Transaction Fee</p>
                    <p>{txFee} </p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <p>You&apos;ll get</p>
                    <p>{Number(amount) - txFee} </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              {String(account.chainId) !== props.orderToken.chainId ? (
                <Button
                  size="large"
                  className="w-full !h-[45px] !text-sm"
                  type="primary"
                  disabled={
                    props.status !== "ACTIVE" ||
                    Number(balance_value) < Number(amount) ||
                    isPending
                  }
                  onClick={openChainModal}
                >
                  Connect to {chains[props.orderToken.chainId].name}
                </Button>
              ) : (
                <Button
                  size="large"
                  className="w-full !h-[45px]"
                  type="primary"
                  disabled={
                    props.status !== "ACTIVE" ||
                    Number(balance_value) < Number(amount) ||
                    isPending ||
                    Number(amount) <= 0
                  }
                  onClick={handleCreateTrade}
                  loading={isPending}
                >
                  Bridge
                </Button>
              )}
              <Button
                size="large"
                className="w-full !h-[45px] !bg-transparent"
                onClick={toggleModal}
              >
                Cancel
              </Button>
            </div>
            <p className="text-grey-300">
              If there is risk, the withdrawal may be delayed.
            </p>
          </div>
        </div>
      </Modal>
      <div className="md:grid md:[grid-template-columns:2fr_1fr_2fr_1fr_1fr] gap-7 items-center text-sm md:py-0 py-2">
        <MerchantInfo {...props} variant="variant_2" />

        <div className="flex items-baseline gap-2 mt-2">
          <p className="md:hidden block text-xs">Destination Chain: </p>
          <p className="md:text-lg text-[16px]">
            {chains[props?.adToken?.chainId!].name}
          </p>
        </div>

        <div className="uppercase">
          <p className="md:font-semibold md:text-[15px]">
            <span className="md:hidden text-grey-400 capitalize pr-2">
              Quantity
            </span>
            <span className="">
              {available_tokens} {tokenSymbol}
            </span>
          </p>
          <p>
            <span className="md:hidden text-grey-400 capitalize pr-2">
              Limits
            </span>
            <span>
              {minAmount} - {maxAmount} {tokenSymbol}
            </span>
          </p>
        </div>

        <div className="flex md:block items-center gap-1 text-grey-400 md:text-inherit">
          <div className="flex items-center gap-1">
            <span className="md:hidden block h-3 w-1 bg-primary"></span>
            <p>{moment(props.updatedAt).format("LL")}</p>
          </div>
          <p>{moment(props.updatedAt).format("LT")}</p>
        </div>

        <div className="w-full flex justify-end md:mt-0 -mt-8">
          <Button
            type="primary"
            className="md:w-[120px] !h-[40px]"
            onClick={toggleModal}
            disabled={props.status !== "ACTIVE"}
          >
            Bridge
          </Button>
        </div>
      </div>
    </div>
  )
}

interface merchantI extends IAd {
  variant?: "variant_1" | "variant_2"
}

const MerchantInfo = ({
  status,
  variant,
  creatorAddress,
  ...props
}: merchantI) => {
  // Ad creators fund on the ad chain — render their address in its native form.
  const displayAddress = formatChainAddress(
    creatorAddress,
    props.adToken?.chainKind,
  )
  const initial = displayAddress[displayAddress.length - 1] ?? "?"

  return (
    <>
      {variant === "variant_2" ? (
        <div className="space-y-[6px]">
          <div className="flex md:flex-col justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar
                size={50}
                className="!bg-amber-300/20 !text-amber-500 font-semibold"
              >
                {initial}
              </Avatar>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-semibold tracking-wider">
                    {truncateString(displayAddress, 5, 5)}
                  </p>
                  <Verified className="text-primary" size={15} />
                </div>
                <Status status={status} size="sm" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-[6px]">
          <div className="flex md:flex-col justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="!bg-amber-300/20 !text-amber-500 font-semibold">
                {initial}
              </Avatar>
              <div>
                <Status status={status} size="sm" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
