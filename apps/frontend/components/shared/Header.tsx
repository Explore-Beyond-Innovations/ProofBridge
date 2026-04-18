import React from "react"
import { Logo } from "./Logo"
import Link from "next/link"
import { ConnectWalletButton } from "../connect-wallet/ConnectWalletButton"

export const Header = () => {
  return (
    <header className="h-[70px] flex items-center justify-center to-grey-1000/40 from-grey-900/40 backdrop-blur-2xl bg-gradient-to-l fixed top-0 left-0 w-full z-[20] border-b border-b-grey-800">
      <div className="px-4 md:px-8 flex items-center justify-between w-full">
        <div className="flex items-baseline gap-2">
          <Link href={"/"}>
            <Logo />
          </Link>
          <p className="text-sm from-primary to-amber-400 bg-gradient-to-r text-transparent bg-clip-text md:block hidden">
            ProofBridge
          </p>
        </div>
        <div className="flex items-center justify-between text-sm gap-8 uppercase">
          <span className="signal-line-link hidden md:inline">
            <Link
              href={"https://github.com/JoE11-y/ProofBridge"}
              target="_blank"
            >
              Docs
            </Link>
          </span>
          <span className="signal-line-link hidden md:inline">
            <Link href={"/bridge"}>Bridge</Link>
          </span>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
