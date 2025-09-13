"use client"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import React from "react"
import { SpecialButton } from "../ui/SpecialButton"

const features = [
  {
    title: "Instant Liquidity Unlock",
    desc: "Users lock ETH or other supported tokens on Ethereum and receive HBAR on Hedera",
    img: "/assets/features/vault.png",
    explore: "First P2P bridge on Hedera",
  },
  {
    title: "ZK-Based Security",
    desc: "Zero-knowledge proofs ensure the user’s L1 collateral is verified without revealing private data or bridging assets, enabling secure minting of xZB.",
    img: "/assets/features/shield.png",
    explore: "First P2P bridge on Hedera",
  },
  {
    title: "Native HBAR Token",
    desc: "xZB is a non-wrapped, USD-pegged stable token issued on Starknet. It’s backed 1:1 by locked collateral on Ethereum L1 and is instantly usable across DeFi applications for lending, trading, and staking.",
    img: "/assets/features/tokens.png",
    explore: "First P2P bridge on Hedera",
  },
  {
    title: "Trustless Architecture",
    desc: "Powered by ZK-proofs, ZeroXBridge eliminates the need for multisigs, validators, or custodians, removing human risk and ensuring user-owned security.",
    img: "/assets/features/wall.png",
    explore: "First P2P bridge on Hedera",
  },
]

export const Features = () => {
  return (
    <div className="relative overflow-hidden landing-features">
      <div className="border-y-[1px] border-gray-400/20 grid md:grid-cols-3 grid-cols-1 mb-10">
        <div className="p-4 py-6 md:p-8 md:py-12 md:border-r-[1px] md:border-gray-400/20 md:min-h-[60vh] min-h-[130px]">
          <p className="text-xs text-grey-200 uppercase">[ Game changer ]</p>
          <p className="md:text-5xl text-lg md:my-5 my-2 font-perfectly-nineties">
            Inside ProofBridge
          </p>
          <Link
            href={"/"}
            className="text-primary uppercase text-lg md:text-[18px] hero-click-to-explore hero-caption relative"
          >
            <SpecialButton>Launch App</SpecialButton>
          </Link>
        </div>
        <div className="col-span-2">
          <div className="">
            {features.map((feature, index) => {
              return (
                <div key={index} className="flex md:flex-row flex-col">
                  {index % 2 != 0 ? (
                    <>
                      <div className="md:w-[50%] h-[30rem] 2xl:h-[35rem] md:border-t-[1px] md:border-r-[1px] md:border-gray-400/20 border-l-[0px] border-grey-400 md:p-0 p-4 overflow-hidden">
                        <img
                          src={feature?.img}
                          className="w-full h-full object-cover bg-black/42"
                        />
                      </div>
                      <div className="md:w-[50%] md:h-[30rem] 2xl:h-[35rem] md:border-t-[1px] md:border-gray-400/20 p-4 md:p-8 md:py-12 flex flex-col gap-7 justify-between">
                        <div>
                          <p className="text-xs text-grey-200 uppercase">
                            feature
                          </p>
                          <p className="md:text-3xl text-lg md:my-3 my-2 font-perfectly-nineties">
                            {feature.title}
                          </p>
                          <p className="2xl:max-w-[65%] opacity-75">
                            {feature.desc}
                          </p>
                        </div>

                        <div>
                          <div className="mb-5">
                            <p className="text-sm text-primary uppercase">
                              explore:
                            </p>
                            <p className="font-medium">
                              First P2P bridge on Hedera
                            </p>
                          </div>
                          <Link href={""}>
                            <ArrowUpRight className="md:text-4xl text-2xl text-primary" />
                          </Link>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:w-[50%] md:h-[30rem] 2xl:h-[35rem] md:border-t-[1px] md:border-gray-400/20 p-4 md:p-8 md:py-12 flex flex-col gap-7 justify-between md:order-1 order-2">
                        <div>
                          <p className="text-xs text-grey-200 uppercase">
                            feature
                          </p>
                          <p className="md:text-3xl text-lg md:my-3 my-2 font-perfectly-nineties">
                            {feature.title}
                          </p>
                          <p className="2xl:max-w-[65%] opacity-75">
                            {feature.desc}
                          </p>
                        </div>

                        <div>
                          <div className="mb-5">
                            <p className="text-sm text-primary uppercase">
                              explore:
                            </p>
                            <p className="font-medium">
                              First P2P bridge on Hedera
                            </p>
                          </div>
                          <Link href={""}>
                            <ArrowUpRight className="md:text-4xl text-2xl text-primary" />
                          </Link>
                        </div>
                      </div>
                      <div className="md:w-[50%] h-[30rem] 2xl:h-[35rem] border-t-[1px] md:border-l-[1px] border-gray-400/20 flex items-center justify-center md:order-2 order-1 overflow-hidden">
                        <img
                          src={feature?.img}
                          className="h-full w-full  object-cover"
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
