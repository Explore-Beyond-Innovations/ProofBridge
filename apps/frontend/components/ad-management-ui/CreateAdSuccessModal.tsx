"use client"
import React from "react"
import { Modal, Button } from "antd"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import moment from "moment"

export interface CreatedAdSummary {
  title: string
  description: string
  amount: string
  min: string
  max: string
  tokenSymbol: string
  baseChainName: string
  orderChainName: string
}

interface CreateAdSuccessModalProps {
  open: boolean
  summary: CreatedAdSummary | null
  onClose: () => void
}

export const CreateAdSuccessModal: React.FC<CreateAdSuccessModalProps> = ({
  open,
  summary,
  onClose,
}) => {
  const router = useRouter()

  const handleViewAd = () => {
    onClose()
    router.push("/home")
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      footer={null}
      width={480}
      title={null}
      styles={{
        content: {
          background: "#121112",
          borderRadius: 16,
          padding: 24,
        },
        mask: { backdropFilter: "blur(12px)" },
      }}
    >
      <div className="flex flex-col items-center text-center mb-5">
        <CheckCircle2 className="text-primary" size={48} />
        <h3 className="text-lg font-semibold mt-3">Ad created</h3>
        <p className="text-xs text-grey-400 mt-1">
          Your liquidity is live and discoverable by bridgers.
        </p>
      </div>

      {summary && (
        <div className="bg-grey-800 rounded-md p-4 text-sm space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Title</span>
            <span className="text-right truncate">{summary.title}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Route</span>
            <span className="text-right">
              <span className="text-primary">{summary.baseChainName}</span>
              <span className="text-grey-500 mx-1">→</span>
              <span className="text-primary">{summary.orderChainName}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Liquidity</span>
            <span className="text-right">
              {summary.amount} {summary.tokenSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Limits</span>
            <span className="text-right">
              {summary.min} – {summary.max} {summary.tokenSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Posted</span>
            <span className="text-right text-grey-300">
              {moment().format("ll")} · {moment().format("LT")}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <Button size="large" onClick={onClose} className="flex-1">
          Close
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={handleViewAd}
          className="flex-1"
        >
          View ad
        </Button>
      </div>
    </Modal>
  )
}
