import { useCreateAd, type TxStage } from "@/hooks/useAds"
import { TxProgress } from "@/components/shared/TxProgress"
import {
  CREATE_AD_STAGES,
  withApprove,
  withTrustline,
} from "@/components/shared/tx-stages"
import { useGetBridgeRoutes } from "@/hooks/useBridgeRoutes"
import { toast } from "sonner"
import { Button, Modal, Select } from "antd"
import { Handshake, Info, ShieldAlert, Text } from "lucide-react"
import moment from "moment"
import Link from "next/link"
import React, { useMemo, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { useAccount, useBalance } from "wagmi"
import { useChainModal } from "@rainbow-me/rainbowkit"
import { useQuery } from "@tanstack/react-query"
import { useGetAllChains } from "@/hooks/useChains"
import { chains as supported_chains, isVisibleChain } from "@/lib/chains"
import { GiCancel } from "react-icons/gi"
import { CiWarning } from "react-icons/ci"
import { useGetAllTokens } from "@/hooks/useTokens"
import { useStellarWallet } from "@/components/providers/StellarWallet"
import { getStellarTokenBalance } from "@/utils/stellar/balance"
import {
  CreateAdSuccessModal,
  type CreatedAdSummary,
} from "./CreateAdSuccessModal"

export const AddLiquidity = () => {
  const account = useAccount()
  const { address: stellarAddress, connect: connectStellar } =
    useStellarWallet()
  const { data: chains, isLoading: loadingChains } = useGetAllChains({
    limit: 10,
  })

  // chainId strings are the source of truth — both EVM (numeric ids) and
  // Stellar (the synthetic "1000001") fit in one field, so the API calls
  // below don't have to special-case non-EVM chains.
  const [baseChainId, setBaseChainId] = useState<string>("")
  const [orderChainId, setOrderChainId] = useState<string>("")

  const baseChain = chains?.data?.find((c) => c.chainId === baseChainId)
  const orderChain = chains?.data?.find((c) => c.chainId === orderChainId)
  const baseChainKind = baseChain?.kind
  const orderChainKind = orderChain?.kind

  // viem Chain only exists for EVM — Stellar has no equivalent, hence
  // `undefined` when the base chain is Stellar. Used for EVM network switching.
  const baseEvmChain =
    baseChainKind === "EVM" ? supported_chains[baseChainId] : undefined

  const baseWalletReady =
    baseChainKind === "EVM"
      ? baseEvmChain?.id === account.chainId
      : baseChainKind === "STELLAR"
        ? Boolean(stellarAddress)
        : false

  // Destination wallet must be connected too — we use its address as
  // `creatorDstAddress` so the ad creator can later claim on the order chain.
  // Without it, handleCreateAd throws and the user sees a dead click.
  const destinationWalletReady =
    orderChainKind === "EVM"
      ? Boolean(account.address)
      : orderChainKind === "STELLAR"
        ? Boolean(stellarAddress)
        : false

  const { openChainModal } = useChainModal()
  const [createStage, setCreateStage] = useState<TxStage>(null)
  const { mutateAsync: createAd, isPending } = useCreateAd({
    onStage: setCreateStage,
  })
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")
  const [isInputError, setIsInputError] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const toggleModal = () => setOpenModal(!openModal)
  const [successSummary, setSuccessSummary] =
    useState<CreatedAdSummary | null>(null)
  const [selectedTokenId, setSelectedTokenId] = useState<string>("")
  const { data: tokens, isLoading: loadingTokens } = useGetAllTokens({
    chainId: baseChainId,
  })
  const { data: routes } = useGetBridgeRoutes({
    adChainId: baseChainId,
    orderChainId,
    adTokenId: selectedTokenId,
  })

  const selectedToken = tokens?.data?.find((t) => t.id === selectedTokenId)
  const isEvmBase = baseChainKind === "EVM"
  const isStellarBase = baseChainKind === "STELLAR"

  const evmNativeBalance = useBalance({
    chainId: baseEvmChain?.id,
    address: account.address,
    query: {
      enabled: isEvmBase && selectedToken?.kind === "NATIVE",
    },
  })
  const evmErc20Balance = useBalance({
    chainId: baseEvmChain?.id,
    address: account.address,
    token:
      selectedToken?.kind === "ERC20"
        ? (selectedToken.address as `0x${string}`)
        : undefined,
    query: {
      enabled: isEvmBase && selectedToken?.kind === "ERC20",
    },
  })
  const stellarBalance = useQuery({
    queryKey: [
      "stellar-balance",
      stellarAddress,
      selectedToken?.id,
      baseChainId,
    ],
    queryFn: () =>
      getStellarTokenBalance(stellarAddress!, {
        kind: selectedToken!.kind,
        symbol: selectedToken!.symbol,
        decimals: selectedToken!.decimals,
        assetIssuer: selectedToken!.assetIssuer ?? undefined,
        address: selectedToken!.address,
      }),
    enabled: isStellarBase && !!stellarAddress && !!selectedToken,
  })

  const balanceDisplay = useMemo(() => {
    if (!selectedToken) return null
    if (isEvmBase) {
      if (!account.address) return { text: "Connect wallet to view balance" }
      const src =
        selectedToken.kind === "NATIVE"
          ? evmNativeBalance
          : selectedToken.kind === "ERC20"
            ? evmErc20Balance
            : null
      if (!src) return null
      if (src.isLoading) return { text: "Loading balance…" }
      if (src.data) {
        return {
          text: `${formatUnits(src.data.value, src.data.decimals)} ${selectedToken.symbol}`,
          value: src.data.value,
        }
      }
      return null
    }
    if (isStellarBase) {
      if (!stellarAddress)
        return { text: "Connect Stellar wallet to view balance" }
      if (stellarBalance.isLoading) return { text: "Loading balance…" }
      if (stellarBalance.data) {
        return {
          text: `${formatUnits(stellarBalance.data.value, stellarBalance.data.decimals)} ${selectedToken.symbol}`,
          value: stellarBalance.data.value,
        }
      }
      return { text: "Balance unavailable" }
    }
    return null
  }, [
    selectedToken,
    isEvmBase,
    isStellarBase,
    account.address,
    stellarAddress,
    evmNativeBalance.data,
    evmNativeBalance.isLoading,
    evmErc20Balance.data,
    evmErc20Balance.isLoading,
    stellarBalance.data,
    stellarBalance.isLoading,
  ])

  const creatorDstAddress =
    orderChainKind === "STELLAR" ? stellarAddress : account.address

  const handleCreateAd = async () => {
    try {
      const token = tokens?.data?.find((value) => value.id === selectedTokenId)
      if (!creatorDstAddress) {
        throw new Error(
          orderChainKind === "STELLAR"
            ? "Connect a Stellar wallet to receive on the destination chain"
            : "Connect an EVM wallet to receive on the destination chain",
        )
      }

      await createAd({
        payload: {
          routeId: routes?.data[0]?.id!,
          creatorDstAddress,

          maxAmount: parseUnits(max, token?.decimals!).toString(),

          minAmount: parseUnits(min, token?.decimals!).toString(),

          metadata: {
            title,
            description,
          },
          fundAmount: parseUnits(amount, token?.decimals!).toString(),
        },
        token: token!,
      })

      setSuccessSummary({
        title,
        description,
        amount,
        min,
        max,
        tokenSymbol: token?.symbol ?? "",
        baseChainName: baseChain?.name ?? "",
        orderChainName: orderChain?.name ?? "",
      })
      toggleModal()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create ad",
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-grey-900 md:p-6 p-3 rounded-md space-y-4">
        <div className="flex items-center gap-4">
          <Text className="text-primary" />
          <p className="text-[16px] tracking-wider font-semibold">
            Trading Details
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <p className="text-grey-300 mb-1">Base Chain</p>
            <div>
              <Select
                loading={loadingChains}
                className="w-full !h-[40px]"
                value={baseChainId || undefined}
                options={chains?.data
                  .filter(
                    (chain) =>
                      isVisibleChain(chain.chainId) &&
                      chain.chainId !== orderChainId,
                  )
                  .map((chain) => ({
                    label: chain.name,
                    value: chain.chainId,
                  }))}
                allowClear={{
                  clearIcon: <GiCancel className="text-red-500" size={15} />,
                }}
                onChange={(value: string) => {
                  setBaseChainId(value ?? "")
                  setSelectedTokenId("")
                }}
                onClear={() => {
                  setBaseChainId("")
                  setSelectedTokenId("")
                }}
              />
            </div>
          </div>

          <div>
            <p className="text-grey-300 mb-1">Destination Chain</p>
            <div>
              <Select
                loading={loadingChains}
                className="w-full !h-[40px]"
                value={orderChainId || undefined}
                options={chains?.data
                  .filter(
                    (chain) =>
                      isVisibleChain(chain.chainId) &&
                      chain.chainId !== baseChainId,
                  )
                  .map((chain) => ({
                    label: chain.name,
                    value: chain.chainId,
                  }))}
                allowClear={{
                  clearIcon: <GiCancel className="text-red-500" size={15} />,
                }}
                onChange={(value: string) => {
                  setOrderChainId(value ?? "")
                }}
                onClear={() => setOrderChainId("")}
              />
            </div>
          </div>

          <div>
            <p className="text-grey-300 mb-1">Token</p>
            <div>
              <Select
                loading={loadingTokens}
                className="w-full !h-[40px]"
                options={tokens?.data.map((token) => ({
                  label: token.name,
                  value: token.id,
                }))}
                allowClear={{
                  clearIcon: <GiCancel className="text-red-500" size={15} />,
                }}
                onChange={(value: string) => {
                  setSelectedTokenId(value)
                }}
                onClear={() => setSelectedTokenId("")}
                value={selectedTokenId}
              />
            </div>
            {selectedToken && balanceDisplay && (
              <p className="text-xs text-grey-300 mt-1 tracking-wider">
                Balance:{" "}
                <span className="text-grey-100">{balanceDisplay.text}</span>
              </p>
            )}
          </div>

          <div>
            <p className="text-grey-300">Liquidity</p>
            <input
              className="w-full h-[40px] border-[1px]"
              placeholder="Amount"
              onChange={(e) => setAmount(e.target.value)}
              type="number"
            />
            {isInputError && !amount && (
              <p className="text-xs text-red-400 tracking-widest">
                Liquidity amount is required
              </p>
            )}
          </div>

          <div>
            <p className="text-grey-300">Minimum Order</p>
            <input
              className="w-full h-[40px] border-[1px]"
              placeholder="Min. Amount"
              type="number"
              onChange={(e) => setMin(e.target.value)}
            />
            {isInputError && !min && (
              <p className="text-xs text-red-400 tracking-widest">
                Min. Order is required
              </p>
            )}
          </div>

          <div>
            <p className="text-grey-300">Maximum Order</p>
            <input
              className="w-full h-[40px] border-[1px]"
              placeholder="Max. Amount"
              type="number"
              onChange={(e) => setMax(e.target.value)}
            />
            {isInputError && !max && (
              <p className="text-xs text-red-400 tracking-widest">
                Max. Order is required
              </p>
            )}
          </div>

          <div>
            <p className="text-grey-300">Title</p>
            <input
              className="w-full h-[40px] border-[1px]"
              placeholder="Give this ad a title"
              onChange={(e) => setTitle(e.target.value)}
            />
            {isInputError && !title && (
              <p className="text-xs text-red-400 tracking-widest">
                Title is required
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-grey-900 md:p-6 p-3 rounded-md space-y-4">
        <div className="flex items-center gap-4">
          <ShieldAlert className="text-amber-400" />
          <p className="text-[16px] tracking-wider font-semibold">
            Trading Terms and description
          </p>
        </div>

        <div>
          <textarea
            placeholder="Instructions & description"
            className="min-h-[130px] w-full border-[1px] border-grey-500 outline-0 p-3 rounded-md focus:border-primary"
            onChange={(e) => setDescription(e.target.value)}
          />
          {isInputError && !description && (
            <p className="text-xs text-red-400 tracking-widest">
              Description is required
            </p>
          )}
        </div>
      </div>

      <div className="bg-grey-900 md:p-6 p-3 rounded-md space-y-4">
        <div className="flex items-center gap-4">
          <p className="text-[16px] tracking-wider font-semibold">Ad Summary</p>
        </div>

        <div className="bg-grey-800 p-2 md:p-4 rounded-md tracking-wider">
          <div className="flex gap-2 items-center text-xs mb-1">
            <Info size={16} className="text-blue-500" />
            <p>What users will see</p>
          </div>
          <p className="text-sm">
            Your ad will appear as a bridge route from{" "}
            <span className="text-primary">{orderChain?.name || "N/A"}</span>{" "}
            (Source) to{" "}
            <span className="text-primary">{baseChain?.name || "N/A"}</span>{" "}
            (Destination) with the information and trading terms specified
            above.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        {!baseChainId ? (
          <div className="flex items-center gap-2 text-yellow-500">
            <CiWarning size={18} />
            <p className="">Please select Base chain.</p>
          </div>
        ) : !orderChainId ? (
          <div className="flex items-center gap-2 text-yellow-500">
            <CiWarning size={18} />
            <p className="">Please select Destination chain.</p>
          </div>
        ) : !selectedTokenId ? (
          <div className="flex items-center gap-2 text-yellow-500">
            <CiWarning size={18} />
            <p className="">Please select A token.</p>
          </div>
        ) : !routes?.data[0] ? (
          <div className="flex items-center gap-2 text-yellow-500">
            <CiWarning size={18} />
            <p className="">Route not available.</p>
          </div>
        ) : !baseWalletReady && baseChainKind === "STELLAR" ? (
          <Button type="primary" size="large" onClick={() => connectStellar()}>
            Connect Stellar
          </Button>
        ) : !baseWalletReady ? (
          <Button type="primary" size="large" onClick={openChainModal}>
            Connect to {baseChain?.name}
          </Button>
        ) : !destinationWalletReady && orderChainKind === "STELLAR" ? (
          <Button type="primary" size="large" onClick={() => connectStellar()}>
            Connect Stellar to receive on {orderChain?.name}
          </Button>
        ) : !destinationWalletReady ? (
          <Button type="primary" size="large" onClick={openChainModal}>
            Connect {orderChain?.name} wallet to receive
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (!title || !description || !amount || !min || !max) {
                setIsInputError(true)
                return
              }
              setIsInputError(false)
              toggleModal()
            }}
            type="primary"
            size="large"
            loading={isPending}
          >
            Preview Ad
          </Button>
        )}
      </div>

      <Modal
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
            <div>
              <div>
                <Handshake className="text-primary" />
                <p className="text-lg mb-4 underline">
                  Providing Liquidity for{" "}
                  <span className="text-primary font-semibold">
                    {baseChain?.name}
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Quantity
                  </p>
                  <p>
                    {amount}{" "}
                    {
                      tokens?.data?.find(
                        (value) => value.id === selectedTokenId,
                      )?.symbol
                    }
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Limits
                  </p>
                  <p>
                    {min} - {max}{" "}
                    {
                      tokens?.data?.find(
                        (value) => value.id === selectedTokenId,
                      )?.symbol
                    }
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Posted
                  </p>
                  <div className="flex items-center gap-1 text-grey-300">
                    <div className="flex items-center gap-1">
                      <span className=" h-3 w-1 bg-primary"></span>
                      <p>{moment().format("ll")}</p>
                    </div>
                    <p>{moment().format("LT")}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[13px] tracking-wide text-grey-300">
              <div className="max-h-[130px] overflow-y-auto mt-2 py-2 pr-2 text-grey-50">
                <p>{description}</p>
              </div>
              <p className="font-semibold mb-1">Advertiser Terms</p>
              <div className="grid [grid-template-columns:12px_1fr] gap-0">
                <Info size={12} className="mt-1" />

                <div className="">
                  <p className="pl-3">
                    Merchants may impose additional terms in the Advertiser
                    Terms. Kindly preview carefully before creating an ad. In
                    the event of any conflict, the Platform&apos;s{" "}
                    <Link href={"#"} className="!text-primary">
                      Terms
                    </Link>{" "}
                    shall prevail. Violations will be penalized by platform
                    protection.
                  </p>
                </div>
              </div>
            </div>
            {createStage && (() => {
              const token = tokens?.data?.find((t) => t.id === selectedTokenId)
              let stages = CREATE_AD_STAGES
              if (baseChainKind === "STELLAR" && token?.kind === "SAC") {
                stages = withTrustline(stages)
              } else if (baseChainKind === "EVM" && token?.kind === "ERC20") {
                stages = withApprove(stages)
              }
              return <TxProgress stages={stages} stage={createStage} />
            })()}
            <Button
              onClick={handleCreateAd}
              className="w-full mt-5"
              type="primary"
              size="large"
              loading={isPending}
            >
              Create Ad
            </Button>
          </div>

          <div>
            <img
              src="/assets/features/vault.png"
              alt=""
              className="w-full h-full"
            />
          </div>
        </div>
      </Modal>

      <CreateAdSuccessModal
        open={successSummary !== null}
        summary={successSummary}
        onClose={() => setSuccessSummary(null)}
      />
    </div>
  )
}
