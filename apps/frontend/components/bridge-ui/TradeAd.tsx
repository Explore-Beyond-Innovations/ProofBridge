"use client"
import React, { useEffect, useMemo, useState } from "react"
import { Avatar, Button, Modal, Skeleton } from "antd"
import { ArrowRight, Info, Verified } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { IAd } from "@/types/ads"
import { chain_icons } from "@/lib/chain-icons"
import { formatUnits, parseUnits } from "viem"
import { parseToBigInt } from "@/lib/parse-to-bigint"
import moment from "moment"
import { useGetAllChains } from "@/hooks/useChains"
import { truncateString } from "@/utils/truncate-string"
import { formatChainAddress } from "@/utils/format-address"
import { Status } from "../shared/Status"
import { useAccount, useBalance } from "wagmi"
import { useCreateTrade, type TxStage } from "@/hooks/useTrades"
import { TxProgress } from "@/components/shared/TxProgress"
import {
  CREATE_ORDER_STAGES,
  withApprove,
  withTrustline,
} from "@/components/shared/tx-stages"
import { useChainModal } from "@rainbow-me/rainbowkit"
import { useStellarWallet } from "@/components/providers/StellarWallet"
import { useQuery } from "@tanstack/react-query"
import { getStellarTokenBalance } from "@/utils/stellar/balance"
import {
  NonExactDownscaleError,
  scale as scaleDecimals,
} from "@/utils/decimal-scaling"
import {
  CreateOrderSuccessModal,
  type CreatedOrderSummary,
} from "./CreateOrderSuccessModal"
import { useAdapters } from "@/components/connect-wallet/useAdapters"
import { ConnectHubModal } from "@/components/connect-wallet/ConnectHubModal"

export const TradeAd = ({ ...props }: IAd) => {
  const [openModal, setOpenModal] = useState(false)
  const toggleModal = () => setOpenModal(!openModal)
  const [successSummary, setSuccessSummary] =
    useState<CreatedOrderSummary | null>(null)

  const available_tokens = formatUnits(
    parseToBigInt(props.availableAmount),
    props.adToken.decimals
  )
  const minAmount = formatUnits(
    parseToBigInt(props.minAmount),
    props.adToken.decimals
  )
  const maxAmount = formatUnits(
    parseToBigInt(props.maxAmount),
    props.adToken.decimals
  )
  const tokenSymbol = props.adToken.symbol
  const { data: chainList } = useGetAllChains({ limit: 50 })
  const resolveChainName = (chainId?: string) =>
    chainList?.data?.find((c) => c.chainId === chainId)?.name ?? ""
  const txFeePercent = 0
  const [amount, setAmount] = useState("")
  const txFee = Number(amount) * (txFeePercent / 100)
  const account = useAccount()
  const [createStage, setCreateStage] = useState<TxStage>(null)
  const { mutateAsync, isPending } = useCreateTrade({ onStage: setCreateStage })
  const { openChainModal } = useChainModal()
  const { address: stellarAddress } = useStellarWallet()
  const adapters = useAdapters()
  const [hubOpen, setHubOpen] = useState(false)
  const adapterFor = (kind: "EVM" | "STELLAR") =>
    adapters.find((a) => a.chainKind === kind)
  const isReady = (kind: "EVM" | "STELLAR") =>
    adapterFor(kind)?.status === "authenticated"

  const isStellarOrder = props.orderToken.chainKind === "STELLAR"
  const nativeBalance = useBalance({
    chainId: Number(props.orderToken.chainId),
    address: account.address,
    query: { enabled: !isStellarOrder },
  })
  const balance = useBalance({
    chainId: Number(props.orderToken.chainId),
    token: props.orderToken.address,
    address: account.address,
    query: { enabled: !isStellarOrder && props.orderToken.kind === "ERC20" },
  })
  const stellarBalance = useQuery({
    queryKey: [
      "stellar-balance",
      stellarAddress,
      props.orderToken.address,
      props.orderToken.chainId,
    ],
    queryFn: () =>
      getStellarTokenBalance(stellarAddress!, {
        kind: props.orderToken.kind,
        symbol: props.orderToken.symbol,
        decimals: props.orderToken.decimals,
        assetIssuer: props.orderToken.assetIssuer,
        address: props.orderToken.address,
      }),
    enabled: isStellarOrder && !!stellarAddress,
  })

  const orderBalanceRaw: bigint | undefined = isStellarOrder
    ? stellarBalance.data?.value
    : props.orderToken.kind === "ERC20"
      ? balance.data?.value
      : nativeBalance.data?.value

  const [balance_value, setBalance_value] = useState("")
  useEffect(() => {
    if (isStellarOrder) {
      if (stellarBalance.data) {
        setBalance_value(
          formatUnits(stellarBalance.data.value, stellarBalance.data.decimals),
        )
      }
      return
    }
    if (balance.data) {
      setBalance_value(
        formatUnits(balance.data.value, balance.data.decimals),
      )
    } else if (nativeBalance.data) {
      setBalance_value(
        formatUnits(nativeBalance.data.value, nativeBalance.data.decimals),
      )
    }
  }, [balance.data, nativeBalance.data, stellarBalance.data, isStellarOrder])

  type ScaledResult =
    | { ok: true; adAmount: bigint; orderAmount: bigint }
    | { ok: false; error: string }
  const scaled = useMemo((): ScaledResult | null => {
    if (!amount || amount.trim() === "") return null
    let adAmount: bigint
    try {
      adAmount = parseUnits(amount, props.adToken.decimals)
    } catch {
      return { ok: false, error: "Invalid amount" }
    }
    if (adAmount <= BigInt(0)) return null
    try {
      const orderAmount = scaleDecimals(
        adAmount,
        props.adToken.decimals,
        props.orderToken.decimals,
      )
      return { ok: true, adAmount, orderAmount }
    } catch (err) {
      if (err instanceof NonExactDownscaleError) {
        return {
          ok: false,
          error: `Amount too precise for ${props.orderToken.symbol} decimals — use a coarser value`,
        }
      }
      return { ok: false, error: "Unsupported decimals configuration" }
    }
  }, [amount, props.adToken.decimals, props.orderToken.decimals, props.orderToken.symbol])

  const orderAmountDisplay =
    scaled && scaled.ok
      ? formatUnits(scaled.orderAmount, props.orderToken.decimals)
      : ""
  const insufficientBalance = Boolean(
    scaled &&
    scaled.ok &&
    orderBalanceRaw !== undefined &&
    scaled.orderAmount > orderBalanceRaw,
  )

  const balanceLoading = isStellarOrder
    ? stellarBalance.isLoading
    : balance.isLoading || nativeBalance.isLoading
  const amountError = scaled && !scaled.ok ? scaled.error : null

  const bridgerDstAddress =
    props.adToken.chainKind === "STELLAR" ? stellarAddress : account.address

  const handleCreateTrade = async () => {
    if (!bridgerDstAddress) return
    if (!scaled || !scaled.ok) return
    await mutateAsync({
      payload: {
        adId: props.id,
        routeId: props.routeId,
        amount: scaled.orderAmount.toString(),
        bridgerDstAddress,
      },
      orderTokenId: props.orderTokenId,
    })
    setSuccessSummary({
      payAmount: formatUnits(scaled.orderAmount, props.orderToken.decimals),
      payTokenSymbol: props.orderToken.symbol,
      receiveAmount: String(Number(amount) - txFee),
      receiveTokenSymbol: props.adToken.symbol,
      orderChainName,
      adChainName,
      recipient: bridgerDstAddress,
    })
    toggleModal()
  }

  const orderChainName = resolveChainName(props.orderToken.chainId)
  const adChainName = resolveChainName(props.adToken.chainId)
  const orderChainKind = props.orderToken.chainKind
  const adChainKind = props.adToken.chainKind
  const connectionAction: {
    label: string
    onClick?: () => void
    isBridge: boolean
  } = (() => {
    // Pay side — wallet must be connected + authenticated for the order chain
    // kind. Both EVM and Stellar go through the same hub.
    if (!isReady(orderChainKind)) {
      return {
        label: `Connect ${orderChainName} wallet`,
        onClick: () => setHubOpen(true),
        isBridge: false,
      }
    }
    // Chain-switch only applies to EVM — Stellar has a single network.
    if (!isStellarOrder && String(account.chainId) !== props.orderToken.chainId) {
      return {
        label: `Switch to ${orderChainName}`,
        onClick: openChainModal,
        isBridge: false,
      }
    }
    // Destination side — the bridger receives on the ad chain, so we need
    // that wallet too (hub handles EVM + Stellar).
    if (!isReady(adChainKind) || !bridgerDstAddress) {
      return {
        label: `Connect ${adChainName} wallet`,
        onClick: () => setHubOpen(true),
        isBridge: false,
      }
    }
    return { label: "Bridge", onClick: handleCreateTrade, isBridge: true }
  })()
  return (
    <div>
      <CreateOrderSuccessModal
        open={successSummary !== null}
        summary={successSummary}
        onClose={() => setSuccessSummary(null)}
      />
      <ConnectHubModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        adapters={adapters}
        zIndex={1100}
      />
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
                    <p>{orderChainName}</p>
                    <ArrowRight size={15} className="text-yellow-500" />
                    <p>{adChainName}</p>
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
            {props.metadata?.description && (
              <div className="font-perfectly-nineties text-[15px] italic leading-relaxed text-grey-50 border-l-2 border-primary/60 pl-3 max-h-[150px] overflow-y-auto">
                {props.metadata.description}
              </div>
            )}
            <div className="text-[13px] tracking-wide text-grey-300">
              <p className="font-semibold mb-1">Advertiser Terms</p>
              <div className="grid [grid-template-columns:12px_1fr] gap-0">
                <Info size={12} className="mt-1" />
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
              </div>
            </div>
          </div>
          <div className="bg-grey-800/60 w-full h-full md:rounded-r-[12px] p-4 md:p-6 md:py-7 space-y-3">
            <div className="flex items-center gap-4">
              <p>{orderChainName} balance</p>
              <span className="font-semibold text-primary font-pixter tracking-wide">
                {(isStellarOrder
                  ? stellarBalance.isLoading
                  : balance.isLoading || nativeBalance.isLoading) ? (
                  <Skeleton.Button active />
                ) : (
                  <>
                    {Number(balance_value).toLocaleString()}{" "}
                    {isStellarOrder
                      ? props.orderToken.symbol
                      : balance?.data?.symbol || nativeBalance?.data?.symbol}
                  </>
                )}
              </span>
            </div>

            <div className="mb-16 space-y-4">
              <div className="h-[80px] w-full bg-grey-900/40 rounded-md p-4 flex flex-col justify-between">
                <p className="text-xs text-grey-300">Amount to Bridge?</p>
                <div className="grid [grid-template-columns:20px_1fr_20%] gap-1 items-center">
                  <span className="h-5 w-5 rounded-full bg-grey-800 flex items-center justify-center text-[10px] font-semibold text-amber-300">
                    {props.adToken.symbol?.[0] ??
                      props.adToken.name?.[0] ??
                      "T"}
                  </span>
                  <input
                    className="w-full !border-0 outline-0 text-lg font-semibold tracking-wider disabled:cursor-not-allowed"
                    type="number"
                    onChange={(e) => setAmount(e.target.value)}
                    value={amount}
                    disabled={
                      isStellarOrder
                        ? stellarBalance.isLoading
                        : balance.isLoading || nativeBalance.isLoading
                    }
                  />
                  <p className="text-[11px] space-x-2">
                    <span>{tokenSymbol}</span>{" "}
                    <span className="text-[10px]">|</span>{" "}
                    <span
                      className="cursor-pointer text-primary"
                      role="button"
                      onClick={() => setAmount(balance_value)}
                    >
                      All
                    </span>
                  </p>
                </div>
                {amountError && (
                  <p className="text-red-400 my-1">{amountError}</p>
                )}
                {!amountError && insufficientBalance && (
                  <p className="text-red-400 my-1">
                    Insuffient funds in wallet
                  </p>
                )}
              </div>
              {scaled && scaled.ok && (
                <div className="w-full bg-grey-900/40 rounded-md p-4 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between w-full">
                    <p>You pay</p>
                    <p>
                      {Number(orderAmountDisplay).toLocaleString()}{" "}
                      {props.orderToken.symbol}
                    </p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <p>Transaction Fee</p>
                    <p>
                      {txFee} {props.adToken.symbol}
                    </p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <p>You&apos;ll get</p>
                    <p>
                      {Number(amount) - txFee} {props.adToken.symbol}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {createStage && (
              <TxProgress
                stages={
                  props.orderToken.chainKind === "STELLAR"
                    ? props.orderToken.kind === "SAC"
                      ? withTrustline(CREATE_ORDER_STAGES)
                      : CREATE_ORDER_STAGES
                    : props.orderToken.kind === "ERC20"
                      ? withApprove(CREATE_ORDER_STAGES)
                      : CREATE_ORDER_STAGES
                }
                stage={createStage}
              />
            )}
            <div className="flex gap-4">
              <Button
                size="large"
                className="w-full !h-[45px] !text-sm"
                type="primary"
                disabled={
                  props.status !== "ACTIVE" ||
                  isPending ||
                  (connectionAction.isBridge &&
                    (!scaled || !scaled.ok || balanceLoading || insufficientBalance))
                }
                onClick={connectionAction.onClick}
                loading={connectionAction.isBridge && isPending}
              >
                {connectionAction.label}
              </Button>
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
      {props.metadata?.title && (
        <p className="mb-3 text-base font-semibold text-grey-50">
          {props.metadata.title}
        </p>
      )}
      <div className="md:grid md:[grid-template-columns:2fr_1fr_2fr_1fr_1fr] gap-7 items-center text-sm md:py-0 py-2">
        <MerchantInfo {...props} variant="variant_2" />

        <div className="flex items-center gap-2 mt-2">
          <p className="md:hidden block text-xs">Destination Chain: </p>
          {chain_icons[props.adToken.chainId] ? (
            <Image
              src={chain_icons[props.adToken.chainId]}
              alt=""
              width={20}
              height={20}
              className="shrink-0"
            />
          ) : (
            <span className="h-5 w-5 rounded-full bg-grey-700 shrink-0" />
          )}
          <p className="md:text-lg text-[16px]">{adChainName}</p>
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
