"use client"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import React from "react"
import { SpecialButton } from "../ui/SpecialButton"

const features = [
  {
    title: "P2P bridge",
    desc: "Peer-to-Peer Cross-Chain Transactions. Direct interaction between users without intermediaries.",
    img: "/bridge.png",
    explore: "P2P bridge across ecosystems",
  },
  {
    title: "ZK-Based Security",
    desc: "Zero-Knowledge Proof Validation. Ensures correctness of computations and state transitions.",
    img: "/assets/features/shield.png",
    explore: "P2P bridge across ecosystems",
  },
  {
    title: "Multi-Chain support",
    desc: "Multi-Chain Compatibility. Supports Ethereum, EVM-compatible chains, and extensibility for non-EVM chains.",
    img: "/assets/features/tokens.png",
    explore: "P2P bridge across ecosystems",
  },
  {
    title: "Trustless Operations",
    desc: "Removes reliance on custodians, relayers, or centralized sequencers.",
    img: "/assets/features/wall.png",
    explore: "P2P bridge across ecosystems",
  },
]

export const Features = () => {
  const router = useRouter()
  return (
    <div className="relative overflow-hidden landing-features z-[5] md:bg-transparent bg-grey-1000">
      <div className="border-y-[1px] border-gray-400/20 grid md:grid-cols-3 grid-cols-1 mb-0">
        <div className="p-4 py-6 md:p-8 md:py-12 md:border-r-[1px] md:border-gray-400/20 md:min-h-[60vh] min-h-[130px]">
          <p className="text-xs text-grey-200 uppercase">[ Game changer ]</p>
          <p className="md:text-5xl text-lg md:my-5 my-2 font-perfectly-nineties">
            Inside ProofBridge
          </p>
          {/* SpecialButton renders as <button>, so we can't nest it inside a
              <Link> (which renders as <a>) — invalid HTML + navigation
              silently breaks. Route imperatively on click instead. */}
          <SpecialButton onClick={() => router.push("/home")}>
            Launch App
          </SpecialButton>
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
                          <p className="2xl:max-w-[85%] opacity-75">
                            {feature.desc}
                          </p>
                        </div>

                        <div>
                          <div className="mb-5">
                            <p className="text-sm text-primary uppercase">
                              explore:
                            </p>
                            <p className="font-medium">{feature.explore}</p>
                          </div>
                          <Link href={"/bridge"}>
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
                          <p className="2xl:max-w-[95%] opacity-75">
                            {feature.desc}
                          </p>
                        </div>

                        <div>
                          <div className="mb-5">
                            <p className="text-sm text-primary uppercase">
                              explore:
                            </p>
                            <p className="font-medium">{feature.explore}</p>
                          </div>
                          <Link href={"/bridge"}>
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
