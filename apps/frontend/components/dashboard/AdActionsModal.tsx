import React, { useMemo, useState } from "react"
import { Modal, Form, InputNumber, Input, Typography } from "antd"
import { IAd } from "@/types/ads"
import { formatUnits, parseUnits } from "viem"
import { parseToBigInt } from "@/lib/parse-to-bigint"
import { useAccount } from "wagmi"
import { useChainModal } from "@rainbow-me/rainbowkit"
import { useQueryClient } from "@tanstack/react-query"
import { useAdapters } from "@/components/connect-wallet/useAdapters"
import { ConnectHubModal } from "@/components/connect-wallet/ConnectHubModal"
import { useGetAllChains } from "@/hooks/useChains"
import {
  useCloseAd,
  useFundAd,
  useWithdrawFunds,
  type TxStage,
} from "@/hooks/useAds"
import { TxProgress } from "@/components/shared/TxProgress"
import {
  FUND_AD_STAGES,
  WITHDRAW_AD_STAGES,
  withApprove,
  withTrustline,
} from "@/components/shared/tx-stages"

type ActionType = "withdraw" | "top-up" | "close"

type Props = {
  actionType: ActionType
  open: boolean
  setOpen: (v: boolean) => void
  toggleOpen: () => void
  ad: IAd
  chain: string
}

export const AdActionsModal: React.FC<Props> = ({
  actionType,
  open,
  setOpen,
  toggleOpen,
  ad,
  chain,
}) => {
  const adapters = useAdapters()
  const adapter = adapters.find((a) => a.chainKind === ad.adToken.chainKind)
  const account = useAccount()
  const { openChainModal } = useChainModal()
  const [hubOpen, setHubOpen] = useState(false)

  const { data: chainList } = useGetAllChains({ limit: 50 })
  const resolvedChain =
    chainList?.data?.find((c) => c.chainId === ad.adToken.chainId)?.name ??
    chain

  const activeAddress = adapter?.address ?? null
  const isAdChainAuthed = adapter?.status === "authenticated"

  const isOnAdChain =
    isAdChainAuthed &&
    (ad.adToken.chainKind !== "EVM" ||
      Number(ad.adToken.chainId) === account.chainId)
  const queryClient = useQueryClient()
  const amount = formatUnits(
    parseToBigInt(ad?.availableAmount),
    ad?.adToken?.decimals
  )
  const [txStage, setTxStage] = useState<TxStage>(null)
  const { mutateAsync: fundAd, isPending: isFundingAd } = useFundAd({
    onStage: setTxStage,
  })
  const { mutateAsync: withdrawFund, isPending: isWithdrawing } =
    useWithdrawFunds({ onStage: setTxStage })
  const { mutateAsync: closeAd, isPending: isClosingAd } = useCloseAd()

  const [form] = Form.useForm<{ amount: string }>()

  const cfg = useMemo(
    () => ({
      title:
        actionType === "withdraw"
          ? "Withdraw"
          : actionType === "top-up"
            ? "Top up"
            : "Close Ad",
      okText:
        actionType === "withdraw"
          ? "Withdraw"
          : actionType === "top-up"
            ? "Top up"
            : "Close ad",
      connectLabel: !isAdChainAuthed
        ? `Connect ${adapter?.name ?? ad.adToken.chainKind} wallet`
        : `Switch to ${resolvedChain}`,
    }),
    [
      actionType,
      isAdChainAuthed,
      adapter?.name,
      ad.adToken.chainKind,
      resolvedChain,
    ]
  )

  const handleOk = async () => {
    if (!isOnAdChain) {
      if (!isAdChainAuthed) {
        setHubOpen(true)
      } else {
        openChainModal?.()
      }
      return
    }
    if (!activeAddress) return
    const values = await form.validateFields().catch(() => null)
    if (!values && actionType !== "close") return

    if (actionType === "top-up") {
      await fundAd({
        poolAmountTopUp: parseUnits(
          values!.amount,
          ad.adToken.decimals
        ).toString(),
        adId: ad.id,
        amountBigInt: parseUnits(values!.amount, ad.adToken.decimals),
        tokenId: ad.adTokenId,
      })
    } else if (actionType === "withdraw") {
      await withdrawFund({
        poolAmountWithdraw: parseUnits(
          values!.amount,
          ad.adToken.decimals
        ).toString(),
        adId: ad.id,
        amountBigInt: parseUnits(values!.amount, ad.adToken.decimals),
        to: activeAddress,
      })
    } else if (actionType === "close") {
      await closeAd({
        adId: ad.id,
        to: activeAddress,
      })
    }
    setOpen(false)
    form.resetFields()
    await queryClient.invalidateQueries({ queryKey: ["get-all-ads"] })
    await queryClient.invalidateQueries({
      queryKey: ["get-single-ad", ad.id],
    })
  }

  const handleCancel = () => {
    if (!isFundingAd || !isWithdrawing || !isClosingAd) {
      form.resetFields()
      toggleOpen()
    }
  }

  return (
    <>
      <ConnectHubModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        adapters={adapters}
        zIndex={1100}
      />
      <Modal
        open={open}
        title={cfg.title}
        okText={isOnAdChain ? cfg.okText : cfg.connectLabel}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={isFundingAd || isWithdrawing || isClosingAd}
        centered
        width={400}
        cancelButtonProps={{
          disabled: isFundingAd || isWithdrawing || isClosingAd,
        }}
        styles={{
          content: { padding: 16, borderRadius: "12px" },
          mask: { backdropFilter: "blur(12px)" },
        }}
      >
        <div className="my-5 grid gap-2 grid-cols-2">
          <div className="space-y-1">
            <div className="flex flex-col">
              <p className="text-primary capitalize pr-2 font-semibold text-xs">
                Chain
              </p>
              <div className="md:text-lg text-lg">
                <p>{resolvedChain}</p>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-col">
              <p className="text-primary capitalize pr-2 font-semibold text-xs">
                Available
              </p>
              <div className="md:text-lg text-lg">
                <h3>
                  {amount}
                  <span className="text-[16px] pl-2">{ad?.adToken?.symbol}</span>
                </h3>
              </div>
            </div>
          </div>
        </div>
        {actionType !== "close" ? (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ amount: undefined, note: "" }}
          >
            <Form.Item
              label="Amount"
              name="amount"
              rules={[{ required: true, message: "Enter amount" }]}
            >
              <InputNumber
                style={{ width: "100%" }}
                placeholder="Enter amount"
                min={0}
                stringMode
              />
            </Form.Item>
            <Form.Item label="Note (optional)" name="note">
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                maxLength={140}
                showCount
              />
            </Form.Item>
          </Form>
        ) : (
          <Form form={form} layout="vertical" initialValues={{ reason: "" }}>
            <Typography.Paragraph>
              Closing stops new orders. Liquidity is withdrawn to your wallet.
            </Typography.Paragraph>
            <Form.Item label="Reason (optional)" name="reason">
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                maxLength={200}
                showCount
              />
            </Form.Item>
          </Form>
        )}
        {txStage && actionType !== "close" && (() => {
          const base =
            actionType === "top-up" ? FUND_AD_STAGES : WITHDRAW_AD_STAGES
          let stages = base
          if (ad.adToken.chainKind === "STELLAR" && ad.adToken.kind === "SAC") {
            stages = withTrustline(stages)
          } else if (
            ad.adToken.chainKind === "EVM" &&
            ad.adToken.kind === "ERC20" &&
            actionType === "top-up"
          ) {
            stages = withApprove(stages)
          }
          return (
            <div className="mt-4">
              <TxProgress stages={stages} stage={txStage} />
            </div>
          )
        })()}
      </Modal>
    </>
  )
}
