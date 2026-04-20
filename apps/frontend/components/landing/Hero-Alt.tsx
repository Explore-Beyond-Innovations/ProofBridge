"use client"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import React from "react"
import { SpecialButton } from "../ui/SpecialButton"
import { useRouter } from "next/navigation"

export const HeroAlt = () => {
  useGSAP(() => {
    // const mm = gsap.matchMedia()

    // mm.add("(min-width: 768px)", () => {

    // })

    gsap.to(".hero-bridge", {
      scrollTrigger: {
        trigger: ".landing-about",
        scrub: true,
        start: "top 100%",
      },
      duration: 0.5,
      skewY: "10deg",
      scale: 1.5,
      y: -100,
    })
  })
  const router = useRouter()
  return (
    <div
      className="md:h-[86vh] h-[72vh] w-full home-hero relative"
      id="home-hero"
    >
      <div className="h-full w-full flex flex-col justify-between">
        <div></div>
        <div className="2xl:text-[11.75rem] lg:text-[8rem] text-[3.75rem] md:p-[40px] p-5 2xl:leading-[160px] lg:leading-[110px] leading-[85%] hero-inner-text fixed z-[20] md:bottom-[12vh] bottom-[36vh] left-0 w-full">
          <h2 className="text-primary tracking-tight floating-text">
            ProofBridge
          </h2>
          <h2 className="text-[#eee] tracking-tight relative inline-block">
            <span className="2xl:text-[9rem] md:text-[6.3rem] text-[3.5rem]">
              P2P cross-chain bridge
            </span>
            <span className="text-[#eeeeeeea] md:text-[16px] md:leading-[24px] text-[12px] leading-4 2xl:text-[20px] 2xl:leading-[30px] block absolute 2xl:-top-[140px] lg:-top-[85px] top-[115px] md:right-0 tracking-normal 2xl:max-w-[250px] md:max-w-[180px] max-w-[80%]">
              ProofBridge® is Unlocking the next generation of cross-chain
              bridging
            </span>
          </h2>
        </div>
        <div className="relative z-5 pt-4 md:hidden block">
          <SpecialButton onClick={() => router.push("/home")}>
            Launch App
          </SpecialButton>
        </div>
      </div>

      <div className="fixed w-screen h-screen top-0 left-0">
        <img
          className="w-full h-full opacity-20 hero-bridge"
          src={"/bridge.png"}
        />
      </div>
    </div>
  )
}
