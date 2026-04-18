"use client"
import React from "react"
import { CiBadgeDollar } from "react-icons/ci"
import { RxDoubleArrowUp } from "react-icons/rx"
import { GiTrade } from "react-icons/gi"
import { TrendingUp } from "lucide-react"
import { IoReceiptOutline } from "react-icons/io5"
import { useGetAllAds } from "@/hooks/useAds"
import { AdCard } from "@/components/dashboard/AdCard"
import { Tabs, TabsProps } from "antd"
import { SkeletonAdCard } from "@/components/dashboard/SkeletonAdCard"
import AdsEmptyState from "@/components/dashboard/AdsEmptyState"
import { useGetAllTrades } from "@/hooks/useTrades"
import { useCurrentUser } from "@/hooks/useCurrentUser"

const HomePage = () => {
  // Pull the full set of linked wallets (one per chain kind) and filter by
  // ANY of them. Using only the EVM wallet misses ads created on Stellar —
  // and vice versa — after a user links both sides.
  const { data: currentUser } = useCurrentUser()
  const linkedAddresses = React.useMemo(
    () => currentUser?.wallets.map((w) => w.address) ?? [],
    [currentUser],
  )
  const hasLinkedAddresses = linkedAddresses.length > 0

  const { data: all_active_ads, isLoading: loadingActive } = useGetAllAds({
    status: "ACTIVE",
    creatorAddresses: hasLinkedAddresses ? linkedAddresses : undefined,
  })

  const { data: all_inactive_ads, isLoading: loadingInActive } = useGetAllAds({
    status: "PAUSED",
    creatorAddresses: hasLinkedAddresses ? linkedAddresses : undefined,
  })

  const { data: all_exhausted_ads, isLoading: loadingExhuasted } = useGetAllAds(
    {
      status: "EXHAUSTED",
      creatorAddresses: hasLinkedAddresses ? linkedAddresses : undefined,
    }
  )

  const { data: all_closed_ads, isLoading: loadingClosed } = useGetAllAds({
    status: "CLOSED",
    creatorAddresses: hasLinkedAddresses ? linkedAddresses : undefined,
  })

  const { data: all_ads, isLoading } = useGetAllAds({
    creatorAddresses: hasLinkedAddresses ? linkedAddresses : undefined,
    limit: 50,
  })

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: "All ads",
      children: (
        <div className="space-y-4 md:space-y-6">
          {isLoading ? (
            <>
              {Array.from([1, 2, 3]).map((value) => (
                <SkeletonAdCard key={value} />
              ))}
            </>
          ) : all_ads?.data?.length === 0 ? (
            <AdsEmptyState
              title="No ads found"
              message="You haven't created any ads yet."
              primaryLabel="Refresh"
              onPrimaryClick={() => window.location.reload()}
            />
          ) : (
            <>
              {all_ads?.data?.map((ad) => {
                return <AdCard ad={ad} key={ad.id} />
              })}
            </>
          )}
        </div>
      ),
    },
    {
      key: "2",
      label: "Active",
      children: (
        <div className="space-y-4 md:space-y-6">
          {loadingActive ? (
            <>
              {Array.from([1, 2, 3]).map((value) => (
                <SkeletonAdCard key={value} />
              ))}
            </>
          ) : all_active_ads?.data?.length === 0 ? (
            <AdsEmptyState
              title="No active ads"
              message="You don't have any active ads right now."
              primaryLabel="Refresh"
              onPrimaryClick={() => window.location.reload()}
            />
          ) : (
            <>
              {all_active_ads?.data?.map((ad) => {
                return <AdCard ad={ad} key={ad.id} />
              })}
            </>
          )}
        </div>
      ),
    },
    {
      key: "3",
      label: "Inactive",
      children: (
        <div className="space-y-4 md:space-y-6">
          {loadingInActive ? (
            <>
              {Array.from([1, 2, 3]).map((value) => (
                <SkeletonAdCard key={value} />
              ))}
            </>
          ) : all_inactive_ads?.data?.length === 0 ? (
            <AdsEmptyState
              title="No inactive ads"
              message="You have no paused or inactive ads."
              primaryLabel="Refresh"
              onPrimaryClick={() => window.location.reload()}
            />
          ) : (
            <>
              {all_inactive_ads?.data?.map((ad) => {
                return <AdCard ad={ad} key={ad.id} />
              })}
            </>
          )}
        </div>
      ),
    },
    {
      key: "4",
      label: "Exhausted",
      children: (
        <div className="space-y-4 md:space-y-6">
          {loadingExhuasted ? (
            <>
              {Array.from([1, 2, 3]).map((value) => (
                <SkeletonAdCard key={value} />
              ))}
            </>
          ) : all_exhausted_ads?.data?.length === 0 ? (
            <AdsEmptyState
              title="No exhausted ads"
              message="There are no ads that have been exhausted."
              primaryLabel="Refresh"
              onPrimaryClick={() => window.location.reload()}
            />
          ) : (
            <>
              {all_exhausted_ads?.data?.map((ad) => {
                return <AdCard ad={ad} key={ad.id} />
              })}
            </>
          )}
        </div>
      ),
    },
    {
      key: "5",
      label: "Closed",
      children: (
        <div className="space-y-4 md:space-y-6">
          {loadingClosed ? (
            <>
              {Array.from([1, 2, 3]).map((value) => (
                <SkeletonAdCard key={value} />
              ))}
            </>
          ) : all_closed_ads?.data?.length === 0 ? (
            <AdsEmptyState
              title="No closed ads"
              message="You have no closed ads."
              primaryLabel="Refresh"
              onPrimaryClick={() => window.location.reload()}
            />
          ) : (
            <>
              {all_closed_ads?.data?.map((ad) => {
                return <AdCard ad={ad} key={ad.id} />
              })}
            </>
          )}
        </div>
      ),
    },
  ]

  const { data: trades } = useGetAllTrades({
    participantAddresses: hasLinkedAddresses ? linkedAddresses : undefined,
  })

  const tradeMetrics = React.useMemo(() => {
    const rows = trades?.data ?? []
    const total = rows.length
    const completed = rows.filter((t) => t.status === "COMPLETED").length
    const avgCompletion = total ? ((completed / total) * 100).toFixed(2) : "0.00"
    return { total, completed, avgCompletion }
  }, [trades?.data])

  return (
    <div className="max-w-[98%] mx-auto space-y-4 md:space-y-8 md:py-2 md:px-0 p-4">
      <div>
        <h2 className="md:text-4xl text-lg">Dashboard</h2>
        <p className="text-sm">Manage your ads and orders here</p>
      </div>
      <div className="grid md:grid-cols-4 grid-cols-2 md:gap-7 gap-4">
        <div className="border-grey-700 border-1 p-4 rounded-md w-full bg-gradient-to-bl from-grey-600 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <GiTrade size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {all_active_ads?.data?.length?.toLocaleString() || 0}
                </h3>
                <p className="text-sm">Active ads</p>
              </div>
            </div>
          </div>
        </div>
        <div className="border-grey-800 border-1 p-4 rounded-md w-full bg-gradient-to-tr from-grey-600 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <CiBadgeDollar size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {tradeMetrics.total.toLocaleString()}
                </h3>
                <p className="text-sm">Total trades</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-grey-800 border-1 p-4 rounded-md w-full bg-gradient-to-bl from-grey-600 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <IoReceiptOutline size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {tradeMetrics.completed.toLocaleString()}
                </h3>
                <p className="text-sm">Completed orders</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-grey-700 border-1 p-4 rounded-md w-full bg-gradient-to-br from-grey-600 to-grey-1000">
          <div className="flex justify-center flex-col gap-2 md:h-[150px] h-[100px] w-full">
            <div className="space-y-2">
              <div className="flex w-full justify-between items-center gap-2">
                <TrendingUp size={24} />
                <RxDoubleArrowUp className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">
                  {tradeMetrics.avgCompletion}%
                </h3>
                <p className="text-sm">Avg. completion</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <Tabs defaultActiveKey="1" items={items} type="line" size="large" />
      </div>
    </div>
  )
}

export default HomePage
