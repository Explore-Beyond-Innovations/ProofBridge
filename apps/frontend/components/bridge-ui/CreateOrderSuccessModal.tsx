"use client"
import React from "react"
import { Modal, Button } from "antd"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import moment from "moment"
import { truncateString } from "@/utils/truncate-string"

export interface CreatedOrderSummary {
  payAmount: string
  payTokenSymbol: string
  receiveAmount: string
  receiveTokenSymbol: string
  orderChainName: string
  adChainName: string
  recipient: string
}

interface CreateOrderSuccessModalProps {
  open: boolean
  summary: CreatedOrderSummary | null
  onClose: () => void
}

export const CreateOrderSuccessModal: React.FC<CreateOrderSuccessModalProps> = ({
  open,
  summary,
  onClose,
}) => {
  const router = useRouter()

  const handleViewOrders = () => {
    onClose()
    router.push("/orders")
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      footer={null}
      width={480}
      title={null}
      zIndex={1500}
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
        <h3 className="text-lg font-semibold mt-3">Order submitted</h3>
        <p className="text-xs text-grey-400 mt-1">
          Your bridge order is live. Track its status on the orders page.
        </p>
      </div>

      {summary && (
        <div className="bg-grey-800 rounded-md p-4 text-sm space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Route</span>
            <span className="text-right">
              <span className="text-primary">{summary.orderChainName}</span>
              <span className="text-grey-500 mx-1">→</span>
              <span className="text-primary">{summary.adChainName}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">You paid</span>
            <span className="text-right">
              {summary.payAmount} {summary.payTokenSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">You&apos;ll receive</span>
            <span className="text-right">
              {summary.receiveAmount} {summary.receiveTokenSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Recipient</span>
            <span className="text-right text-grey-300 font-mono text-xs">
              {truncateString(summary.recipient, 10, 8)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-grey-400 text-xs">Submitted</span>
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
          onClick={handleViewOrders}
          className="flex-1"
        >
          View orders
        </Button>
      </div>
    </Modal>
  )
}
