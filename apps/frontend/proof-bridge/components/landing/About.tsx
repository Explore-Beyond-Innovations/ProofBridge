"use client"
import React from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { SplitText } from "gsap/SplitText"
import { ScrollTrigger } from "gsap/ScrollTrigger"
gsap.registerPlugin(SplitText, ScrollTrigger)

const textAnimation = (trigger: string, end?: string) => {
  let split = SplitText.create(trigger, { type: "chars" })
  // now animate the characters in a staggered fashion
  gsap.from(split.chars, {
    // duration: 1,
    opacity: 0.3, // animate from 100px below
    stagger: 0.02, // 0.05 seconds between each
    y: 7,
    scrollTrigger: {
      trigger: trigger,
      scrub: true,
      // endTrigger: "#approach-info",
      end: end || "10px",
      // start: "top top",
    },
  })
}

export const About = () => {
  useGSAP(() => {
    gsap.to(".about-big-text", {
      scrollTrigger: {
        trigger: ".landing-features",
        scrub: true,
        start: "top 150%",
      },
      y: 500,
      duration: 0.5,
    })
    // textAnimation(".about-text", "300px")
  })
  return (
    <div className="md:min-h-screen scrollbar-hide py-7 md:py-28 landing-about p-4 md:px-10 overflow-x-hidden">
      <div className="">
        <div className="grid md:grid-cols-4 md:gap-10">
          <h3 className="text-[64px] md:leading-[44px] font-perfectly-nineties ">
            Mission
          </h3>
          <div className="text-xs md:leading-5 text-primary">
            <p>What is</p>
            <p>ProofPlay?</p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <div className="2xl:w-[80%]">
              <p className="2xl:text-[28px] md:text-xl 2xl:leading-[35px] indent-[7rem] about-text">
                {/* <span className="font-perfectly-nineties italic">
                  ProofBridge
                </span>{" "} */}
                ProofBridge is a decentralized protocol that unlocks cross-chain
                liquidity without requiring users to bridge or move their
                original assets across chains. Instead of bridging assets, users
                lock ETH or other supported tokens on Ethereum (L1) and
                instantly receive HBAR tokens on Hedera. These tokens are
                native, and backed 1:1 by the user's collateral locked on
                Ethereum.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="scrollbar-hide">
        <h1 className="scrollbar-hide -mt-10 2xl:text-[75vmin] 2xl:leading-[88vmin] md:text-[65vmin] md:leading-[75vmin] text-[39vmin] font-perfectly-nineties italic opacity-10 about-big-text">
          Bridge
        </h1>
      </div>
    </div>
  )
}
