import { BridgeTab } from "@/components/bridge-ui/BridgeTab"
import { Logo } from "@/components/shared/Logo"
import Link from "next/link"
import React from "react"

const BridgePage = () => {
  return (
    <div className="max-w-[1150px] mx-auto space-y-4 md:space-y-4">
      <div className="w-full bg-grey-900 p-4 rounded-md md:block hidden">
        <div className=" mx-auto">
          <div className="flex items-center justify-between gap-6 w-full">
            <div>
              <h3 className="md:text-xl tracking-widest font-pixter font-medium">
                P2P cross-chain bridge across Ethereum &amp; Stellar
              </h3>
              <p className="text-[13px]">
                Unlocking the next generation of cross-chain bridging between
                Ethereum and Stellar.{" "}
                <Link href={"/"} className="underline text-primary">
                  create ad
                </Link>
              </p>
              <p></p>
            </div>

            <div>
              <Logo height={30} width={40} />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-20">
        <BridgeTab />
      </div>
    </div>
  )
}

export default BridgePage
