"use client"
import React from "react"
import { Logo } from "./Logo"
import Link from "next/link"
import { ConnectWalletButton } from "../connect-wallet/ConnectWalletButton"
import { NotificationBell } from "../notifications/NotificationBell"
import { ReplayTourButton } from "../onboarding/ReplayTourButton"
import { Menu, X } from "lucide-react"

interface HeaderProps {
  mobileMenuOpen?: boolean
  onToggleMobileMenu?: () => void
}

export const Header = ({ mobileMenuOpen, onToggleMobileMenu }: HeaderProps) => {
  return (
    <header className="h-[70px] flex items-center justify-center to-grey-1000/40 from-grey-900/40 backdrop-blur-2xl bg-gradient-to-l fixed top-0 left-0 w-full z-[20] border-b border-b-grey-800">
      <div className="px-4 md:px-8 flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger toggle */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-grey-200 hover:text-grey-0 hover:bg-grey-800 transition-all duration-200"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <div className="relative w-5 h-5">
              <Menu
                size={20}
                className={`absolute inset-0 transition-all duration-300 ${
                  mobileMenuOpen
                    ? "opacity-0 rotate-90 scale-75"
                    : "opacity-100 rotate-0 scale-100"
                }`}
              />
              <X
                size={20}
                className={`absolute inset-0 transition-all duration-300 ${
                  mobileMenuOpen
                    ? "opacity-100 rotate-0 scale-100"
                    : "opacity-0 -rotate-90 scale-75"
                }`}
              />
            </div>
          </button>

          <div className="flex items-baseline gap-2">
            <Link href={""}>
              <Logo />
            </Link>
            <p className="text-sm from-primary to-amber-400 bg-gradient-to-r text-transparent bg-clip-text md:block hidden">
              ProofBridge
            </p>
          </div>
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
          <ReplayTourButton />
          <NotificationBell />
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
