"use client"
import { Button } from "antd"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import React from "react"
import ScrollTrigger from "gsap/dist/ScrollTrigger"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(ScrollTrigger)

export const Header = () => {
  useGSAP(() => {
    gsap.to(".main-header", {
      scrollTrigger: {
        trigger: ".header-anime",
        scrub: true,
        start: "top 0%",
      },
      // borderBottom: "0.5px solid #c3ff49",
      // color: "#FF006E",
      background: "#0a0a0a",
    })
  })
  return (
    <div className="fixed top-0 left-0 w-full bg-transparent text-white p-4 md:px-10 py-3 z-[50] main-header">
      <div className="w-full flex items-center justify-between text-sm">
        <ul className="md:flex hidden gap-4">
          <li>
            <Link href={""}>Docs</Link>
          </li>
          <li>
            <Link href={""}>Community</Link>
          </li>
          <li>
            <Link href={""}>Blog</Link>
          </li>
          <li>
            <Link href={""}>X/Twitter</Link>
          </li>
        </ul>

        <p className="text-xl">ProofBridge</p>
        <div>
          <Button
            className="!bg-white !text-black !h-[45px] md:w-[170px] !rounded-full !border-0 !text-[16px] !items-center !leading-0"
            iconPosition="end"
            icon={<ArrowRight size={18} />}
          >
            Launch app
          </Button>
        </div>
      </div>
    </div>
  )
}
