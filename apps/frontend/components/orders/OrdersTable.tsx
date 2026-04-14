"use client"

import React, { useState } from "react"
import { Button, Modal, Table } from "antd"
import type { TableColumnsType, TableProps } from "antd"
import { ITrade } from "@/types/trades"
import {
  useGetAllTrades,
  useLockFunds,
  useUnLockFunds,
} from "@/hooks/useTrades"
import { useAccount } from "wagmi"
import { truncateString } from "@/utils/truncate-string"
import { formatChainAddressShort } from "@/utils/format-address"
import { Status } from "../shared/Status"
import moment from "moment"
import { formatUnits } from "viem"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { chains } from "@/lib/chains"
import { useChainModal, useConnectModal } from "@rainbow-me/rainbowkit"
import { parseToBigInt } from "@/lib/parse-to-bigint"

type DataIndex = keyof ITrade

const onChange: TableProps<ITrade>["onChange"] = (
  pagination,
  filters,
  sorter,
  extra
) => {
  console.log("params", pagination, filters, sorter, extra)
}

export const OrdersTable: React.FC<{ type?: "incoming" | "outgoing" }> = ({
  type = "incoming",
}) => {
  const account = useAccount()
  const { data, isLoading, refetch, isRefetching } = useGetAllTrades({
    bridgerAddress: type === "outgoing" ? account.address : undefined,
    adCreatorAddress: type === "incoming" ? account.address : undefined,
  })
  const [tradeInfo, setTradeInfo] = useState<ITrade>()
  const [openReleaseModal, setOpenReleaseModal] = useState(false)

  const columns: TableColumnsType<ITrade> = [
    {
      title: "Reference",
      dataIndex: "id",
      render: (value) => {
        return truncateString(value, 3, 3)
      },
    },
    type === "incoming"
      ? {
        title: "Bridger",
        dataIndex: "bridgerAddress",
        render: (value, rowData) => {
          // Bridger pays on the order chain.
          const kind = rowData.route.orderToken.chain.kind
          return <p>{formatChainAddressShort(value, kind, 3, 3)}</p>
        },
      }
      : {
        title: "Ad Creator",
        dataIndex: "adCreatorAddress",
        render: (value, rowData) => {
          // Ad creator funds on the ad chain.
          const kind = rowData.route.adToken.chain.kind
          return <p>{formatChainAddressShort(value, kind, 3, 3)}</p>
        },
      },
    {
      title: "Amount",
      dataIndex: "amount",
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (value, rowData) => {
        return (
          <p>
            {formatUnits(parseToBigInt(value), rowData.route.orderToken.decimals)}{" "}
            <span className="text-sm">{rowData.route.orderToken.symbol}</span>
          </p>
        )
      },
    },
    {
      title: "Route",
      dataIndex: "route",
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (value, rowData) => {
        return (
          <div className="flex items-center gap-1">
            {type === "incoming" ? (
              <>
                <p>{rowData.route.adToken.chain.name}</p>
                <ArrowRight size={14} className="text-primary" />
                <p>{rowData.route.orderToken.chain.name}</p>
              </>
            ) : (
              <>
                <p>{rowData.route.orderToken.chain.name}</p>
                <ArrowRight size={14} className="text-primary" />
                <p>{rowData.route.adToken.chain.name}</p>
              </>
            )}
          </div>
        )
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      showSorterTooltip: { target: "full-header" },
      filters: [
        { text: "ACTIVE", value: "ACTIVE" },
        { text: "LOCKED", value: "LOCKED" },
        { text: "INACTIVE", value: "INACTIVE" },
        { text: "COMPLETED", value: "COMPLETED" },
      ],
      onFilter: (value, record) => record.status.indexOf(value as string) === 0,
      sortDirections: ["descend"],
      render: (value) => {
        return <Status status={value} />
      },
    },

    {
      title: "Updated",
      dataIndex: "updatedAt",
      sorter: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
      render: (value) => {
        return (
          <p>
            {moment(value).format("ll")}, {moment(value).format("LT")}
          </p>
        )
      },
    },

    {
      title: "Action",
      dataIndex: "status",
      render: (value, rowData) => {
        return (
          <Action
            value={value}
            rowData={rowData}
            setTradeInfo={setTradeInfo}
            setOpenReleaseModal={setOpenReleaseModal}
            refetch={refetch}
          />
        )
      },
    },
  ]

  const chainModal = useChainModal()
  const { mutateAsync: unlockFunds, isPending: unlockingFunds } =
    useUnLockFunds()
  const isBridger = account.address === tradeInfo?.bridgerAddress
  const isAdCreator = account.address === tradeInfo?.adCreatorAddress
  const adTokenChain = tradeInfo?.route?.adToken?.chain
  const orderTokenChain = tradeInfo?.route?.orderToken?.chain
  const isAdChain = adTokenChain?.chainId === String(account.chainId)
  const isOrderChain = orderTokenChain?.chainId === String(account.chainId)
  const bridgerIsNotConnected = isBridger && !isAdChain
  const adCreatorIsNotConnected = isAdCreator && !isOrderChain
  const { mutateAsync: lockFunds, isPending: lockingFunds } = useLockFunds()

  return (
    <>
      <Table<ITrade>
        columns={columns}
        dataSource={data?.data!}
        loading={isLoading || isRefetching}
        onChange={onChange}
        showSorterTooltip={{ target: "sorter-icon" }}
        rowClassName={"bg-grey-900/60 hover:!bg-primary/20"}
      />

      <Modal
        open={openReleaseModal}
        title={
          <p className="text-sm">
            {isAdCreator && tradeInfo?.status === "ACTIVE" ? (
              <>Lock tokens</>
            ) : (
              <>
                Claim Tokens from{" "}
                {isAdCreator ? orderTokenChain?.name : adTokenChain?.name}
              </>
            )}
          </p>
        }
        okText={
          type === "incoming" && tradeInfo?.status === "ACTIVE" ? (
            <>{!isAdChain ? `Connect to ${adTokenChain?.name}` : "Lock"}</>
          ) : (
            <>
              {bridgerIsNotConnected
                ? `Connect to ${adTokenChain?.name}`
                : adCreatorIsNotConnected
                  ? `Connect to ${orderTokenChain?.name}`
                  : "Claim"}
            </>
          )
        }
        onOk={async () => {
          if (type === "incoming" && tradeInfo?.status === "ACTIVE") {
            if (!isAdChain) {
              chainModal.openChainModal && chainModal.openChainModal()
            } else {
              await lockFunds(tradeInfo?.id!)
              setOpenReleaseModal(false)
              refetch()
            }
          } else if (type === "incoming" && tradeInfo?.status === "LOCKED") {
            if (!isOrderChain) {
              chainModal.openChainModal && chainModal.openChainModal()
            } else {
              await unlockFunds(tradeInfo?.id!)
              setOpenReleaseModal(false)
              refetch()
            }
          } else if (type === "outgoing" && tradeInfo?.status === "LOCKED") {
            if (!isAdChain) {
              chainModal.openChainModal && chainModal.openChainModal()
            } else {
              await unlockFunds(tradeInfo?.id!)
              setOpenReleaseModal(false)
              refetch()
            }
          }
        }}
        onCancel={() => setOpenReleaseModal(false)}
        confirmLoading={unlockingFunds || lockingFunds}
        centered
        width={400}
        cancelButtonProps={{
          disabled: unlockingFunds || lockingFunds,
        }}
        styles={{
          content: { padding: 16, borderRadius: "12px" },
          mask: { backdropFilter: "blur(12px)" },
        }}
      >
        {tradeInfo && (
          <div className="space-y-4 mt-5 text-sm">
            <div className="bg-grey-900/60 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-grey-300">Trade ID</span>
                <span className="font-medium">
                  {truncateString(tradeInfo.id, 4, 4)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-grey-300">Amount</span>
                <span className="font-medium">
                  {formatUnits(
                    parseToBigInt(tradeInfo.amount),
                    tradeInfo.route.orderToken.decimals
                  )}{" "}
                  {tradeInfo.route.orderToken.symbol}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-grey-300">Route</span>

                <div className="flex items-center gap-2 text-xs">
                  {type === "incoming" ? (
                    <>
                      <p>{tradeInfo.route.adToken.chain.name}</p>
                      <ArrowRight size={12} className="text-primary" />
                      <p>{tradeInfo.route.orderToken.chain.name}</p>
                    </>
                  ) : (
                    <>
                      <p>{tradeInfo.route.orderToken.chain.name}</p>
                      <ArrowRight size={12} className="text-primary" />
                      <p>{tradeInfo.route.adToken.chain.name}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-grey-300">Bridger</span>
                <span className="font-medium">
                  {formatChainAddressShort(
                    tradeInfo.bridgerAddress,
                    tradeInfo.route.orderToken.chain.kind,
                    4,
                    4,
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-grey-300">Created</span>
                <span className="font-medium">
                  {moment(tradeInfo.createdAt).format("lll")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-grey-300">Status</span>
                <Status status={tradeInfo.status} />
              </div>
            </div>

            <div className="bg-amber-500/10 p-3 rounded-lg">
              {tradeInfo.status === "ACTIVE" ? (
                <p className="text-amber-500 text-sm">
                  This action cannot be undone.
                </p>
              ) : (
                <p className="text-amber-500 text-sm">
                  Please ensure you have received the tokens before releasing
                  the tokens on your end. This action cannot be undone.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

const Action = ({
  rowData,
  setTradeInfo,
  setOpenReleaseModal,
}: {
  value: string
  rowData: ITrade
  setTradeInfo: (value: ITrade) => void
  setOpenReleaseModal: (value: boolean) => void
  refetch: () => void
  type?: "incoming" | "outgoing"
}) => {
  const { address } = useAccount()
  const isBridger = address === rowData.bridgerAddress
  const isCreator = address === rowData.adCreatorAddress

  if (isBridger && rowData.bridgerClaimed) {
    return <p>-</p>
  }
  if (isCreator && rowData.adCreatorClaimed) {
    return <p>-</p>
  }
  return (
    <>
      {rowData.status === "LOCKED" ? (
        <Button
          type="primary"
          size="small"
          className="!w-full !h-[35px]"
          onClick={() => {
            setOpenReleaseModal(true)
            setTradeInfo(rowData)
          }}
        >
          Claim
        </Button>
      ) : rowData.status === "ACTIVE" &&
        address === rowData.adCreatorAddress ? (
        <>
          <Button
            type="primary"
            size="small"
            className="!w-full !h-[35px]"
            onClick={() => {
              setOpenReleaseModal(true)
              setTradeInfo(rowData)
            }}
          >
            Lock
          </Button>
        </>
      ) : (
        <p className="text-center">-</p>
      )}
    </>
  )
}
