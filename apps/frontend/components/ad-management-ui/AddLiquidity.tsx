import { useCreateAd } from "@/hooks/useAds"
import { useGetBridgeRoutes } from "@/hooks/useBridgeRoutes"
import { Button, Modal, Select } from "antd"
import { Handshake, Info, ShieldAlert, Text } from "lucide-react"
import moment from "moment"
import Link from "next/link"
import React, { useState } from "react"
import { Chain, parseUnits } from "viem"
import { useAccount } from "wagmi"
import { useChainModal } from "@rainbow-me/rainbowkit"
import { useGetAllChains } from "@/hooks/useChains"
import { isVisibleChain } from "@/lib/chains"
import { GiCancel } from "react-icons/gi"
import {
  hederaTestnet,
  sepolia,
  polygonAmoy,
  optimismSepolia,
} from "viem/chains"
import { CiWarning } from "react-icons/ci"
import { useGetAllTokens } from "@/hooks/useTokens"
import { useStellarWallet } from "@/components/providers/StellarWallet"

const supported_chains: Record<number, Chain> = {
  [hederaTestnet.id]: hederaTestnet,
  [sepolia.id]: sepolia,
  [polygonAmoy.id]: polygonAmoy,
  [optimismSepolia.id]: optimismSepolia,
}

export const AddLiquidity = () => {
  const account = useAccount()
  const { address: stellarAddress } = useStellarWallet()
  const { data: chains, isLoading: loadingChains } = useGetAllChains({
    limit: 10,
  })
  const [base_chain, setBase_chain] = useState<Chain>()
  const [order_chain, setOrder_chain] = useState<Chain>()
  const [orderChainId, setOrderChainId] = useState<string>("")
  const orderChainKind = chains?.data?.find(
    (c) => c.chainId === orderChainId,
  )?.kind
  const is_base_chain = base_chain?.id === account.chainId
  const { openChainModal } = useChainModal()
  const { mutateAsync: createAd, isPending } = useCreateAd()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")
  const [isInputError, setIsInputError] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const toggleModal = () => setOpenModal(!openModal)
  const [selectedTokenId, setSelectedTokenId] = useState<string>("")
  const { data: tokens, isLoading: loadingTokens } = useGetAllTokens({
    chainId: String(base_chain?.id),
  })
  const { data: routes, isLoading: loadingRoutes } = useGetBridgeRoutes({
    adChainId: String(base_chain?.id),
    orderChainId: orderChainId || String(order_chain?.id),
    adTokenId: selectedTokenId,
  })

  // Creator's receive address lives on the *order chain* (destination). Pick
  // the wallet matching that chain's kind so we don't submit a 0x EVM address
  // as a Stellar G-strkey or vice versa.
  const creatorDstAddress =
    orderChainKind === "STELLAR" ? stellarAddress : account.address

  const handleCreateAd = async () => {
    try {
      const token = tokens?.data?.find((value) => value.id === selectedTokenId);
      if (!creatorDstAddress) {
        throw new Error(
          orderChainKind === "STELLAR"
            ? "Connect a Stellar wallet to receive on the destination chain"
            : "Connect an EVM wallet to receive on the destination chain",
        )
      }

      const response = await createAd({
        payload: {
          routeId: routes?.data[0]?.id!,
          creatorDstAddress,

          maxAmount: parseUnits(
            max,
            token?.decimals!
          ).toString(),

          minAmount: parseUnits(
            min,
            token?.decimals!
          ).toString(),

          metadata: {
            title,
            description,
          },
          fundAmount: parseUnits(
            amount,
            token?.decimals!
          ).toString(),
        },
        token: token!,
      })

      toggleModal()
    } catch (error) { }
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
                options={chains?.data
                  .filter(
                    (chain) =>
                      isVisibleChain(chain.chainId) &&
                      Number(chain.chainId) !== order_chain?.id!
                  )
                  .map((chain) => {
                    return {
                      label: chain.name,
                      value: chain.chainId,
                    }
                  })}
                allowClear={{
                  clearIcon: <GiCancel className="text-red-500" size={15} />,
                }}
                onChange={(value: number) => {
                  setBase_chain(supported_chains[value])
                  setSelectedTokenId("")
                }}
                onClear={() => setBase_chain(undefined)}
              />
            </div>
          </div>

          <div>
            <p className="text-grey-300 mb-1">Destination Chain</p>
            <div>
              <Select
                loading={loadingChains}
                className="w-full !h-[40px]"
                options={chains?.data
                  .filter(
                    (chain) =>
                      isVisibleChain(chain.chainId) &&
                      Number(chain.chainId) !== base_chain?.id!
                  )
                  .map((chain) => {
                    return {
                      label: chain.name,
                      value: chain.chainId,
                    }
                  })}
                allowClear={{
                  clearIcon: <GiCancel className="text-red-500" size={15} />,
                }}
                onChange={(value: number) => {
                  setOrder_chain(supported_chains[value])
                  setOrderChainId(String(value))
                }}
                onClear={() => {
                  setOrder_chain(undefined)
                  setOrderChainId("")
                }}
              />
            </div>
          </div>

          <div>
            <p className="text-grey-300 mb-1">Token</p>
            <div>
              <Select
                loading={loadingTokens}
                className="w-full !h-[40px]"
                options={tokens?.data.map((token) => {
                  return {
                    label: token.name,
                    value: token.id,
                  }
                })}
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
            Your ad will appear as: Base{" "}
            <span className="text-primary">{base_chain?.name || "N/A"}</span>{" "}
            for Destination{" "}
            <span className="text-primary">{order_chain?.name || "N/A"}</span>{" "}
            with the information and trading terms specified above.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        {!base_chain ? (
          <div className="flex items-center gap-2 text-yellow-500">
            <CiWarning size={18} />
            <p className="">Please select Base chain.</p>
          </div>
        ) : !order_chain ? (
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
        ) : (
          <>
            {is_base_chain ? (
              <Button
                onClick={() => {
                  if (!title || !description || !amount || !min || !max) {
                    setIsInputError(true)
                    return
                  }
                  setIsInputError(false)
                  toggleModal()
                }}
                className=""
                type="primary"
                size="large"
                loading={isPending}
              >
                Preview Ad
              </Button>
            ) : (
              <Button type="primary" size="large" onClick={openChainModal}>
                Connect to {base_chain?.name}
              </Button>
            )}
          </>
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
                    {base_chain?.name}
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
                        (value) => value.id === selectedTokenId
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
                        (value) => value.id === selectedTokenId
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
    </div>
  )
}
