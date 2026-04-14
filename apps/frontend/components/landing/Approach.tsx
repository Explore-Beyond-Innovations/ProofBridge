"use client"
import React from "react"
import { CgArrowRight } from "react-icons/cg"
import { FaArrowRight } from "react-icons/fa"
import Link from "next/link"
import gsap from "gsap"
import { SplitText } from "gsap/SplitText"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin"

gsap.registerPlugin(SplitText, ScrollTrigger, ScrambleTextPlugin)

const textAnimation = (trigger: string, end?: string) => {
  const split = SplitText.create(trigger, { type: "words, chars" })
  // now animate the characters in a staggered fashion
  gsap.from(split.chars, {
    // duration: 1,
    opacity: 0.1, // animate from 100px below
    stagger: 0.05, // 0.05 seconds between each
    scrollTrigger: {
      trigger: trigger,
      scrub: true,
      // endTrigger: "#approach-info",
      end: end || "10px",
    },
  })
}

export const OurApproach = () => {
  useGSAP(() => {
    textAnimation(".big-text", "-40px")
    // textAnimation(".text-1")
    // textAnimation(".text-2")
    // textAnimation(".text-3")
    // textAnimation(".text-4")
  })
  return (
    <div id="#approach">
      <div className="p-[20px] md:p-[80px]">
        <div className="grid md:grid-cols-4 gap-4">
          <FaArrowRight className="md:text-[4rem] md:mt-10 md:inline hidden" />
          <div className="col-span-3 ">
            <h3 className="md:text-[3rem] text-[1.7rem] leading-[1.13] font-medium font-polysans md:mb-[10rem] mb-8 big-text">
              Leveraging zero-knowledge proofs (ZKPs) and user-driven consensus
              to achieve trustless interoperability without relying on
              centralized relayers or custodians.
            </h3>
            <div
              className="grid md:grid-cols-3 gap-4 md:text-[1.35rem] text-[1rem]"
              id="approach-info"
            >
              <p className="font-perfectly-nineties md:text-2xl text-lg text-1 text-primary">
                (What is ProofBridge?)
              </p>
              <div className="col-span-2 md:w-[75%]">
                <p className="mb-8 font-polysans md:text-[1.3rem] text-lg text-2">
                  ProofBridge is the new frontier of bridging, connecting
                  Ethereum and Stellar.
                </p>
                <div className="space-y-7 text-grey-300">
                  <p className="font-polysans text-3">
                    ProofBridge is a P2P cross-chain platform enabling direct
                    peer-to-peer transactions and data exchange between
                    blockchain networks. It leverages zero-knowledge proofs
                    (ZKPs) and user-driven consensus to achieve trustless
                    interoperability without relying on centralized relayers or
                    custodians.
                  </p>
                  <p className="font-polysans">
                    ProofBridge introduces a decentralized bridge infrastructure
                    where users form the consensus layer. Instead of relying on
                    validator committees or external relayers, counterparties
                    themselves verify and agree on proof data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
