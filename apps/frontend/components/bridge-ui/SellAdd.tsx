"use client"
import React, { useState } from "react"
import { Avatar, Button, Modal } from "antd"
import { Clock, Info, ThumbsUp, Verified } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface propsI {
  ad_id: string
  full_name: string
  total_orders: number
  orders_completion_rate: string
  avg_order_completion_time: string
  token: string
  price: string
  available_tokens: string
  limit: string
  date_posted: { date: string; time: string }
  advertiser_terms: string
}

export const SellAd = ({ ...props }: propsI) => {
  const {
    ad_id,
    token,
    price,
    available_tokens,
    limit,
    date_posted,
    advertiser_terms,
  } = props
  const [openModal, setOpenModal] = useState(false)
  const toggleModal = () => setOpenModal(!openModal)
  return (
    <div>
      <Modal
        forceRender
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
            <div className="space-y-3">
              <MerchantInfo {...props} variant="variant_2" />
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Verified className="" size={12} />
                  <p className="">Email</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary">
                  <ThumbsUp className="" size={12} />
                  <p className="">Positive feedbacks</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Verified className="" size={12} />
                  <p className="">Verified</p>
                </div>
              </div>
            </div>

            <div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Quantity
                  </p>
                  <p>{available_tokens}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Limits
                  </p>
                  <p>{limit}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-grey-200 capitalize pr-2 font-semibold text-xs">
                    Posted
                  </p>
                  <div className="flex items-center gap-1 text-grey-300">
                    <div className="flex items-center gap-1">
                      <span className=" h-3 w-1 bg-primary"></span>
                      <p>{date_posted.date}</p>
                    </div>
                    <p>{date_posted.time}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[13px] tracking-wide text-grey-300">
              <p className="font-semibold mb-1">Advertiser Terms</p>
              <div className="grid [grid-template-columns:12px_1fr] gap-0">
                <Info size={12} className="mt-1" />
                <div className="">
                  <p className="pl-3">
                    Merchants may impose additional terms in the Advertiser
                    Terms. Kindly read carefully before placing an order. In the
                    event of any conflict, the Platform&apos;s{" "}
                    <Link href={"#"} className="!text-primary">
                      Terms
                    </Link>{" "}
                    shall prevail. Violations will not be covered by platform
                    protection.
                  </p>
                  <div className="max-h-[130px] overflow-y-auto mt-2 py-2 pr-2 text-grey-50">
                    <p>{advertiser_terms}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-grey-800/60 w-full h-full md:rounded-r-[12px] p-4 md:p-6 md:py-7 space-y-3">
            <div className="flex items-center gap-4">
              <p>Price</p>
              <p className="font-semibold text-red-400 font-pixter tracking-wide">
                {price}
                {token}
              </p>
            </div>

            <div className="mb-16 space-y-4">
              <div className="h-[80px] w-full bg-grey-900/40 rounded-md p-4 flex flex-col justify-between">
                <p className="text-xs text-grey-300">I will get</p>
                <div className="grid [grid-template-columns:20px_1fr_17%] gap-1 items-center">
                  <Image
                    src={"/assets/logos/stellar-logo.svg"}
                    alt=""
                    height={20}
                    width={20}
                    className="rounded-full"
                  />
                  <input className="w-full !border-0 outline-0 text-lg font-semibold tracking-wider" />
                  <p className="text-[11px] space-x-2">
                    <span>{token}</span> <span className="text-[10px]">|</span>{" "}
                    <span className="cursor-pointer text-primary" role="button">
                      All
                    </span>
                  </p>
                </div>
              </div>
              <div className="h-[80px] w-full bg-grey-900/40 rounded-md p-4 flex flex-col justify-between">
                <p className="text-xs text-grey-300">I will deposit</p>
                <div className="grid [grid-template-columns:20px_1fr_17%] gap-1 items-center">
                  <Image
                    src={"/assets/logos/eth.png"}
                    alt=""
                    height={20}
                    width={20}
                    className="rounded-full"
                  />
                  <input className="w-full !border-0 outline-0 text-lg font-semibold tracking-wider" />
                  <p className="text-[11px] space-x-2">
                    <span>{token}</span> <span className="text-[10px]">|</span>{" "}
                    <span className="cursor-pointer text-primary" role="button">
                      All
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                size="large"
                className="w-full !h-[45px]"
                type="primary"
                danger
              >
                Sell
              </Button>
              <Button
                size="large"
                className="w-full !h-[45px] !bg-transparent"
                onClick={toggleModal}
              >
                Cancel
              </Button>
            </div>
            <p className="text-grey-300">
              If there is risk, the withdrawal may be delayed by up to 24 hours.
            </p>
          </div>
        </div>
      </Modal>
      <div className="md:grid md:[grid-template-columns:2fr_1fr_2fr_1fr_1fr] gap-7 items-center text-sm md:py-0 py-2">
        <MerchantInfo {...props} />

        <div className="flex items-baseline gap-2 font-bold">
          <p className="text-xl">{price}</p>
          <p className="text-xs">{token}</p>
        </div>

        <div className="uppercase">
          <p className="md:font-semibold md:text-[15px]">
            <span className="md:hidden text-grey-400 capitalize pr-2">
              Quantity
            </span>
            {available_tokens}
          </p>
          <p>
            <span className="md:hidden text-grey-400 capitalize pr-2">
              Limits
            </span>
            {limit}
          </p>
        </div>

        <div className="flex md:block items-center gap-1 text-grey-400 md:text-inherit">
          <div className="flex items-center gap-1">
            <span className="md:hidden block h-3 w-1 bg-primary"></span>
            <p>{date_posted.date}</p>
          </div>
          <p>{date_posted.time}</p>
        </div>

        <div className="w-full flex justify-end md:mt-0 -mt-8">
          <Button
            type="primary"
            className="md:w-[120px]"
            onClick={toggleModal}
            danger
          >
            Sell
          </Button>
        </div>
      </div>
    </div>
  )
}

interface merchantI extends propsI {
  variant?: "variant_1" | "variant_2"
}

const MerchantInfo = ({
  full_name,
  avg_order_completion_time,
  orders_completion_rate,
  total_orders,
  variant,
}: merchantI) => {
  const initial = full_name ? full_name.trim()[0].toUpperCase() : "U"

  return (
    <>
      {variant === "variant_2" ? (
        <div className="space-y-[6px]">
          <div className="flex md:flex-col justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar
                size={50}
                className="!bg-amber-300/20 !text-amber-500 font-semibold"
              >
                {initial}
              </Avatar>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-semibold tracking-wider">{full_name}</p>
                  <Verified className="text-primary" size={15} />
                </div>
                <div className="flex items-center gap-1 md:hidden text-xs text-grey-300">
                  <Clock size={12} />
                  <p>{avg_order_completion_time}</p>
                </div>
                <div className="flex items-center md:gap-1 gap-1 md:text-sm text-xs md:text-inherit text-grey-300">
                  <p>{total_orders} order(s)</p>
                  <p>|</p>
                  <p>{orders_completion_rate}</p>
                </div>
                <div className="md:flex items-center gap-1 hidden text-xs">
                  <Clock size={12} />
                  <p>{avg_order_completion_time}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-[6px]">
          <div className="flex md:flex-col justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="!bg-amber-300/20 !text-amber-500 font-semibold">
                {initial}
              </Avatar>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-semibold tracking-wider">{full_name}</p>
                  <Verified className="text-primary" size={15} />
                </div>
                <div className="flex items-center gap-1 md:hidden text-xs text-grey-300">
                  <Clock size={12} />
                  <p>{avg_order_completion_time}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center md:gap-3 gap-1 md:text-sm text-xs md:text-inherit text-grey-300">
              <p>{total_orders} order(s)</p>
              <p>|</p>
              <p>{orders_completion_rate}</p>
            </div>
          </div>

          <div className="md:flex items-center gap-1 hidden">
            <Clock size={16} />
            <p>{avg_order_completion_time}</p>
          </div>
        </div>
      )}
    </>
  )
}
