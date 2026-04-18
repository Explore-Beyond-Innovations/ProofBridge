"use client"
import React from "react"
import Link from "next/link"
import { MobileNav } from "./MobileNav"
import { Logo } from "../shared/Logo"
import { Button } from "antd"
import { ArrowRight } from "lucide-react"

export const LandingHeaderAlt = () => {
  return (
    <div className="w-full fixed top-0 left-0 text-[#eee] z-[100]">
      <div className="w-full px-5 md:px-10 py-[10px] flex items-center justify-between border-b-[1px] border-b-gray-300/30 bg-[#0f0f11]/90 backdrop-blur-[5px] uppercase text-sm relative z-[100]">
        <Logo />
        <ul className="md:flex items-center gap-14 hidden">
          <li className="signal-line-link">
            <Link
              href={"https://docs.pfbridge.xyz/"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </Link>
          </li>
          <li className="signal-line-link">
            <Link href={"https://x.com/Proof_bridge"} target="_blank">
              Community
            </Link>
          </li>
          <li className="signal-line-link">
            <Link href={"https://x.com/Proof_bridge"} target="_blank">
              Blog
            </Link>
          </li>
          <li className="signal-line-link">
            <Link href={"https://x.com/Proof_bridge"} target="_blank">
              Contact
            </Link>
          </li>
        </ul>
        <div className="md:block hidden">
          <Link href={"/home"}>
            <Button
              className="!bg-white !text-black !h-[40px] md:w-[170px] !rounded-full !border-0 !text-[16px] !items-center !leading-0"
              iconPosition="end"
              icon={<ArrowRight size={18} />}
            >
              Launch app
            </Button>
          </Link>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
