import React from "react"
import { Logo } from "./Logo"
import Link from "next/link"
import { ConnectWalletButton } from "../connect-wallet/ConnectWalletButton"
import { NotificationBell } from "../notifications/NotificationBell"

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
        <div className="flex items-center justify-between text-sm gap-4 md:gap-8">
          <span className="signal-line-link hidden md:inline uppercase">
            <Link
              href={"https://docs.pfbridge.xyz/"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </Link>
          </span>
          <span className="signal-line-link hidden md:inline uppercase">
            <Link href={"/bridge"}>Bridge</Link>
          </span>
          <NotificationBell />
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
