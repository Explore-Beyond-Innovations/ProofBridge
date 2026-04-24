"use client"
import React, { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CiBadgeDollar } from "react-icons/ci"
import { RxDoubleArrowUp } from "react-icons/rx"
import { GiTrade } from "react-icons/gi"
import { TrendingUp } from "lucide-react"
import { IoReceiptOutline } from "react-icons/io5"
import { OrdersTable } from "@/components/orders/OrdersTable"
import { Tabs, TabsProps } from "antd"
import { useGetAllTrades } from "@/hooks/useTrades"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { PageTourButton } from "@/components/onboarding/PageTourButton"

const OrdersPage = () => {
  const searchParams = useSearchParams()
  const highlight = searchParams.get("highlight")
  const [type, setType] = useState<"incoming" | "outgoing">("incoming")
  const items: TabsProps["items"] = [
    {
      key: "incoming",
      label: "My Ads",
      children: <OrdersTable type="incoming" highlight={highlight} />,
    },

    {
      key: "outgoing",
      label: "My Bridges",
      children: <OrdersTable type="outgoing" highlight={highlight} />,
    },
  ]

  const { data: currentUser } = useCurrentUser()
  const linkedAddresses =
    currentUser?.wallets?.map((w) => w.address).filter(Boolean) ?? []

  const { data: trades } = useGetAllTrades({
    adCreatorAddress:
      type === "incoming" && linkedAddresses.length > 0
        ? linkedAddresses
        : undefined,
    bridgerAddress:
      type === "outgoing" && linkedAddresses.length > 0
        ? linkedAddresses
        : undefined,
  })

  // If a notification deep-links us to a specific trade, auto-switch to the
  // tab that actually contains it so the user doesn't land on an empty list.
  // Fetch both sides independently so we don't miss a trade on the other tab.
  const { data: allTradesForHighlight } = useGetAllTrades(
    highlight && linkedAddresses.length > 0
      ? { participantAddresses: linkedAddresses }
      : { participantAddresses: undefined },
  )
  useEffect(() => {
    if (!highlight) return
    const rows = allTradesForHighlight?.data ?? []
    const match = rows.find((t) => t.id === highlight)
    if (!match) return
    const linkedLower = new Set(
      linkedAddresses.map((a) => a.toLowerCase()),
    )
    const ownsAdCreator =
      typeof match.adCreatorAddress === "string" &&
      linkedLower.has(match.adCreatorAddress.toLowerCase())
    setType(ownsAdCreator ? "incoming" : "outgoing")
  }, [highlight, allTradesForHighlight, linkedAddresses])

  const metrics = useMemo(() => {
    const rows = trades?.data ?? []
    const total = rows.length
    const completed = rows.filter((t) => t.status === "COMPLETED").length
    const pending = rows.filter(
      (t) => t.status === "INACTIVE" || t.status === "ACTIVE" || t.status === "LOCKED",
    ).length
    const avgCompletion = total ? ((completed / total) * 100).toFixed(2) : "0.00"
    return { total, completed, pending, avgCompletion }
  }, [trades?.data])
  return (
    <div className="max-w-[98%] mx-auto space-y-4 md:space-y-8 md:py-2 md:px-0 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="md:text-4xl text-lg">Orders</h2>
          <p className="text-sm">View and Manage your orders here</p>
        </div>
        <PageTourButton flow="orders" />
      </div>
      <div
        data-tour="orders-stats"
        className="grid md:grid-cols-4 grid-cols-2 md:gap-7 gap-4 text-white"
      >
        <div className="border-grey-800 border-1 p-4 rounded-md w-full bg-gradient-to-bl from-primary/20 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <CiBadgeDollar size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {metrics.total}
                </h3>
                <p className="text-sm ">Total trades</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-grey-700 border-1 p-4 rounded-md w-full bg-gradient-to-tr from-primary/20 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <GiTrade size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {metrics.pending}
                </h3>
                <p className="text-sm ">Pending Orders</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-grey-800 border-1 p-4 rounded-md w-full bg-gradient-to-bl from-primary/20 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <IoReceiptOutline size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {metrics.completed}
                </h3>
                <p className="text-sm ">Completed orders</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-grey-700 border-1 p-4 rounded-md w-full bg-gradient-to-br from-primary/20 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <TrendingUp size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {metrics.avgCompletion}%
                </h3>
                <p className="text-sm ">Avg. completion</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-tour="orders-tabs">
        <Tabs
          activeKey={type}
          items={items}
          type="line"
          onChange={(activeKey) =>
            setType(activeKey as "incoming" | "outgoing")
          }
        />
      </div>
    </div>
  )
}

export default OrdersPage
