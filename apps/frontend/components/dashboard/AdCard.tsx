"use client"
import { chain_icons } from "@/lib/chain-icons"
import { getChainName } from "@/lib/chains"
import { IAd } from "@/types/ads"
import { truncateString } from "@/utils/truncate-string"
import { ArrowRight, Dot, Shield } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import React, { useState } from "react"
import { hederaTestnet, sepolia } from "viem/chains"
import { VscVerifiedFilled } from "react-icons/vsc"
import { Status } from "../shared/Status"
import { formatUnits } from "viem"
import { RxDash } from "react-icons/rx"
import moment from "moment"
import { Button } from "antd"
import { AdActionsModal } from "./AdActionsModal"
import { parseToBigInt } from "@/lib/parse-to-bigint"

const explorer_urls: Record<string, string> = {
  [hederaTestnet.id]: hederaTestnet.blockExplorers.default.url,
  [sepolia.id]: sepolia.blockExplorers.default.url,
}

export const AdCard = ({ ad }: { ad: IAd }) => {
  const [openModal, setOpenModal] = useState(false)
  const toggleModal = () => setOpenModal(!openModal)
  const [actionType, setActionType] = useState<
    "withdraw" | "top-up" | "close"
  >()
  const amount = formatUnits(
    parseToBigInt(ad?.availableAmount),
    ad?.adToken?.decimals
  )
  return (
    <>
      <div className="min-h-[100px] space-y-4 md:space-y-5 p-4 border-grey-700 border-1 rounded-lg bg-grey-900">
        <div className="flex items-center gap-5 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <Image
              src={chain_icons[Number(ad?.adToken?.chainId)]}
              alt=""
              height={50}
              width={50}
              className="bg-amber-500/10 p-1 rounded-full"
            />
            <div>
              <div className="inline-flex items-center gap-2">
                <Link
                  href={`${explorer_urls[ad?.adToken?.chainId]}/address/${
                    ad?.adToken?.address
                  }`}
                  className="text-sm !underline"
                  target="_blank"
                >
                  {ad?.metadata?.title || truncateString(ad?.id, 6, 6)}
                </Link>
                <Shield className="text-primary" size={16} />
              </div>

              <div className="text-sm flex gap-1">
                <p>
                  <span className="text-grey-300">Chain:</span>{" "}
                  {getChainName(ad?.adToken?.chainId)}
                </p>
                <Dot className="text-grey-300" />
                <div className="flex items-center gap-1">
                  <p>Verified</p>
                  <VscVerifiedFilled className="text-primary" />
                </div>
              </div>
            </div>
          </div>

          <Status status={ad?.status} />
        </div>
        <div className="grid 2xl:grid-cols-4 md:grid-cols-3 gap-5">
          <div className="">
            <p className="text-sm text-grey-300">Bridge Route</p>
            <div className="md:text-2xl text-lg flex items-center gap-2">
              <h3>{getChainName(ad?.orderToken?.chainId)}</h3>
              <ArrowRight size={15} />
              <h3>{getChainName(ad?.adToken?.chainId)}</h3>
            </div>
            <p className="text-[12px] text-grey-300 flex items-center gap-1">
              <span>{ad?.orderToken?.symbol}</span>
              <ArrowRight size={10} />
              <span>{ad?.adToken?.symbol}</span>
            </p>
          </div>

          <div className="">
            <p className="text-sm text-grey-300">Available</p>
            <div className="md:text-2xl text-lg">
              <h3>
                {amount}
                <span className="text-[16px] pl-2">{ad?.adToken?.symbol}</span>
              </h3>
            </div>
            <p className="text-[12px] text-grey-300">~ Liquidity</p>
          </div>

          <div className="">
            <p className="text-sm text-grey-300">Limits</p>
            <div className="md:text-2xl text-lg flex items-center gap-2">
              <h3>
                {formatUnits(
                  parseToBigInt(ad?.minAmount || "0"),
                  ad?.adToken?.decimals
                )}
              </h3>
              <RxDash size={15} />
              <h3>
                {formatUnits(
                  parseToBigInt(ad?.maxAmount || "0"),
                  ad?.adToken?.decimals
                )}
                <span className="text-[16px] pl-2">{ad?.adToken?.symbol}</span>
              </h3>
            </div>
            <p className="text-[12px] text-grey-300">Per order</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-grey-300 capitalize pr-2 font-semibold text-xs">
              Last updated
            </p>
            <div className="flex items-center gap-1 text-grey-100 text-sm">
              <div className="flex items-center gap-1">
                <span className=" h-3 w-1 bg-primary"></span>
                <p>{moment(ad.updatedAt).format("ll")}</p>
              </div>
              <p>{moment(ad.updatedAt).format("LT")}</p>
            </div>
          </div>

          {ad.status !== "CLOSED" && (
            <div className="flex gap-4">
              {amount !== "0" && (
                <Button
                  className="!h-[40px] w-[90px] !font-semibold !border-primary"
                  onClick={() => {
                    setActionType("withdraw")
                    toggleModal()
                  }}
                >
                  Withdraw
                </Button>
              )}
              <Button
                className="!h-[40px] w-[90px] !font-semibold"
                type="primary"
                onClick={() => {
                  setActionType("top-up")
                  toggleModal()
                }}
              >
                Top up
              </Button>
              <Button
                className="!h-[40px] w-[90px] !font-semibold"
                type="primary"
                danger
                onClick={() => {
                  setActionType("close")
                  toggleModal()
                }}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>

      <AdActionsModal
        open={openModal}
        setOpen={setOpenModal}
        toggleOpen={toggleModal}
        actionType={actionType!}
        ad={ad}
        chain={getChainName(ad?.adToken?.chainId)}
      />
    </>
  )
}
