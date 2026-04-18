"use client"

import React, { useMemo, useState } from "react"
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
import { useChainModal } from "@rainbow-me/rainbowkit"
import { parseToBigInt } from "@/lib/parse-to-bigint"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useAdapters } from "@/components/connect-wallet/useAdapters"
import { ConnectHubModal } from "@/components/connect-wallet/ConnectHubModal"
import type { ChainKind } from "@/types/chains"

const onChange: TableProps<ITrade>["onChange"] = (
  pagination,
  filters,
  sorter,
  extra
) => {
  console.log("params", pagination, filters, sorter, extra)
}

const ownsAddress = (linked: Set<string>, addr: string | null | undefined) =>
  Boolean(addr) && linked.has(addr!.toLowerCase())

export const OrdersTable: React.FC<{ type?: "incoming" | "outgoing" }> = ({
  type = "incoming",
}) => {
  const account = useAccount()
  const { data: currentUser } = useCurrentUser()
  const linkedAddresses = useMemo(
    () => currentUser?.wallets?.map((w) => w.address).filter(Boolean) ?? [],
    [currentUser],
  )
  const linkedSet = useMemo(
    () => new Set(linkedAddresses.map((a) => a.toLowerCase())),
    [linkedAddresses],
  )
  const { data, isLoading, refetch, isRefetching } = useGetAllTrades({
    adCreatorAddress:
      type === "incoming" && linkedAddresses.length > 0
        ? linkedAddresses
        : undefined,
    bridgerAddress:
      type === "outgoing" && linkedAddresses.length > 0
        ? linkedAddresses
        : undefined,
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
            linkedSet={linkedSet}
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
  const { mutateAsync: lockFunds, isPending: lockingFunds } = useLockFunds()
  const adapters = useAdapters()
  const [hubOpen, setHubOpen] = useState(false)
  const adapterFor = (kind: ChainKind) =>
    adapters.find((a) => a.chainKind === kind)
  const isWalletReady = (kind: ChainKind) =>
    adapterFor(kind)?.status === "authenticated"

  const isBridger = ownsAddress(linkedSet, tradeInfo?.bridgerAddress)
  const isAdCreator = ownsAddress(linkedSet, tradeInfo?.adCreatorAddress)
  const adTokenChain = tradeInfo?.route?.adToken?.chain
  const orderTokenChain = tradeInfo?.route?.orderToken?.chain

  // The chain the current action happens on depends on role + status. Ad
  // creator: lock on ad chain, unlock on order chain. Bridger: unlock on ad
  // chain. Ad creator can never trigger a bridger-only unlock and vice versa.
  const targetChain =
    type === "incoming" && tradeInfo?.status === "ACTIVE"
      ? adTokenChain
      : type === "incoming" && tradeInfo?.status === "LOCKED"
        ? orderTokenChain
        : type === "outgoing" && tradeInfo?.status === "LOCKED"
          ? adTokenChain
          : undefined
  const targetChainKind = targetChain?.kind as ChainKind | undefined
  const targetChainId = targetChain?.chainId
  const needsWalletConnect = Boolean(
    targetChainKind && !isWalletReady(targetChainKind),
  )
  // EVM-only check — Stellar has a single network, so the "on the right chain"
  // concept only applies to EVM targets.
  const needsChainSwitch =
    !needsWalletConnect &&
    targetChainKind === "EVM" &&
    targetChainId !== String(account.chainId)

  return (
    <>
      <Table<ITrade>
        columns={columns}
        dataSource={data?.data!}
        loading={isLoading || isRefetching}
        onChange={onChange}
        showSorterTooltip={{ target: "sorter-icon" }}
        rowClassName={"bg-grey-900/60 hover:!bg-primary/20"}
        rowKey="id"
      />

      <ConnectHubModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        adapters={adapters}
        zIndex={1100}
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
          needsWalletConnect
            ? `Connect ${targetChain?.name ?? "wallet"}`
            : needsChainSwitch
              ? `Switch to ${targetChain?.name}`
              : type === "incoming" && tradeInfo?.status === "ACTIVE"
                ? "Lock"
                : "Claim"
        }
        onOk={async () => {
          if (needsWalletConnect) {
            setHubOpen(true)
            return
          }
          if (needsChainSwitch) {
            chainModal.openChainModal?.()
            return
          }
          if (!tradeInfo) return
          if (type === "incoming" && tradeInfo.status === "ACTIVE") {
            await lockFunds(tradeInfo.id)
          } else if (tradeInfo.status === "LOCKED") {
            await unlockFunds(tradeInfo.id)
          }
          setOpenReleaseModal(false)
          refetch()
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
                  This action generates a proof for you to claim your tokens.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

const WaitingNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-grey-400 italic">{children}</p>
)

const Action = ({
  rowData,
  linkedSet,
  setTradeInfo,
  setOpenReleaseModal,
}: {
  value: string
  rowData: ITrade
  linkedSet: Set<string>
  setTradeInfo: (value: ITrade) => void
  setOpenReleaseModal: (value: boolean) => void
  refetch: () => void
  type?: "incoming" | "outgoing"
}) => {
  const isBridger = ownsAddress(linkedSet, rowData.bridgerAddress)
  const isCreator = ownsAddress(linkedSet, rowData.adCreatorAddress)

  // Terminal + settled for this role — nothing to do here.
  if (rowData.status === "COMPLETED") {
    return <WaitingNote>Order completed</WaitingNote>
  }
  if (isBridger && rowData.bridgerClaimed) {
    return <WaitingNote>Funds claimed — waiting for ad creator</WaitingNote>
  }
  if (isCreator && rowData.adCreatorClaimed) {
    return <WaitingNote>Funds claimed — waiting for bridger</WaitingNote>
  }

  if (rowData.status === "ACTIVE") {
    if (isCreator) {
      return (
        <Button
          type="primary"
          size="small"
          className="w-full! h-8.75!"
          onClick={() => {
            setOpenReleaseModal(true)
            setTradeInfo(rowData)
          }}
        >
          Lock
        </Button>
      )
    }
    if (isBridger) {
      return <WaitingNote>Waiting for ad creator to lock order</WaitingNote>
    }
    return <WaitingNote>Awaiting ad creator</WaitingNote>
  }

  if (rowData.status === "LOCKED") {
    // After lock, both sides must sign unlock. Show the actionable button for
    // whichever party hasn't claimed yet, and a waiting note for the other.
    if (isBridger && !rowData.bridgerClaimed) {
      return (
        <Button
          type="primary"
          size="small"
          className="w-full! h-8.75!"
          onClick={() => {
            setOpenReleaseModal(true)
            setTradeInfo(rowData)
          }}
        >
          Claim
        </Button>
      )
    }
    if (isCreator && !rowData.adCreatorClaimed) {
      return (
        <Button
          type="primary"
          size="small"
          className="w-full! h-8.75!"
          onClick={() => {
            setOpenReleaseModal(true)
            setTradeInfo(rowData)
          }}
        >
          Claim
        </Button>
      )
    }
    return <WaitingNote>Waiting for counterparty</WaitingNote>
  }

  if (rowData.status === "INACTIVE") {
    return <WaitingNote>Awaiting on-chain confirmation</WaitingNote>
  }

  return <p className="text-center">-</p>
}
