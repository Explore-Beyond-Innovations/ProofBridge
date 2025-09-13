"use client"
import { Button } from "antd"
import { ArrowRight } from "lucide-react"
import React from "react"
import { SpecialButton } from "../ui/SpecialButton"
import ScrollTrigger from "gsap/dist/ScrollTrigger"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(ScrollTrigger)

export const Hero = () => {
  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add("(min-width: 768px)", () => {
      gsap.to(".hero-bl-text", {
        scrollTrigger: {
          trigger: ".landing-about",
          scrub: true,
          start: "top 100%",
        },
        opacity: 0,
        y: -200,
        duration: 0.5,
      })
    })

    gsap.to(".hero-overlay", {
      scrollTrigger: {
        trigger: ".landing-about",
        scrub: true,
        start: "top 100%",
      },
      backgroundColor: "#000",
      opacity: 1,
    })
  })

  return (
    <div className="relative overflow-x-hidden md:h-screen h-[50vh] landing-hero">
      <div className="absolute top-0 left-0 w-screen md:h-screen h-[50vh] ">
        <video
          src="/bridge-2.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            maxHeight: "100%",
          }}
        />
      </div>
      <div className="absolute top-0 left-0 w-screen md:h-screen h-[50vh] bg-black/45 z-[2] hero-overlay"></div>

      <div className="flex flex-col justify-between h-full relative z-[10] p-4 md:px-10 py-3 md:pb-10 hero-bl-text">
        <div></div>
        <div className="max-w-[1200px] font-perfectly-nineties">
          <h2 className="md:text-5xl text-lg">Game changing </h2>
          <h2 className="md:text-8xl text-xl">
            P2P{" "}
            <span className="bg-clip-text bg-gradient-to-r from-[#AEF78E] to-[#C0D461] inline-block">
              Cross-chain
            </span>{" "}
            Bridge
          </h2>
          <p className="text-xl">
            Unlocking the next generation of cross-chain bridging on Hedera
          </p>
          <div className="flex items-center gap-5 mt-4">
            <Button
              className="!bg-white !text-black !h-[45px] md:w-[170px] !rounded-full !border-0 !text-[16px] !items-center !leading-0"
              iconPosition="end"
              icon={<ArrowRight size={18} />}
            >
              Launch app
            </Button>
            <SpecialButton>Read Docs</SpecialButton>
          </div>
        </div>
      </div>
    </div>
  )
}
