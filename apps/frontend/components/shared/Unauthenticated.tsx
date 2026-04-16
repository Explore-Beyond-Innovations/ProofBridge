"use client"
import React from "react"
import { Wallet } from "lucide-react"
import { ConnectWalletButton } from "../connect-wallet/ConnectWalletButton"

interface UnauthenticatedProps {
  className?: string
}

export const Unauthenticated: React.FC<UnauthenticatedProps> = ({
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`max-w-xl min-h-[70vh] flex flex-col items-center justify-center mx-auto p-6 rounded-md text-center ${className}`}
    >
      <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center rounded-full bg-primary/10 text-primary">
        <Wallet size={36} />
      </div>

      <h3 className="text-2xl font-semibold mb-1">Connect your wallet</h3>
      <p className="text-sm text-grey-300 mb-6 max-w-[28rem] mx-auto">
        ProofBridge works across Ethereum and Stellar. Sign in with either
        network to manage your ads, trades, and liquidity.
      </p>

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <ConnectWalletButton />
      </div>

      <div className="mt-6 flex items-center justify-center gap-5 text-xs text-grey-400">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logos/eth.svg"
            alt="Ethereum"
            width={14}
            height={14}
            className="h-3.5 w-3.5"
          />
          Ethereum Sepolia
        </div>
        <span className="text-grey-700">•</span>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logos/stellar-logo.svg"
            alt="Stellar"
            width={14}
            height={14}
            className="h-3.5 w-3.5"
          />
          Stellar Testnet
        </div>
      </div>

      <p className="text-[11px] text-grey-500 mt-4 max-w-[28rem]">
        Supported wallets: MetaMask, Rainbow, WalletConnect (Ethereum);
        Freighter, Albedo, Lobstr, xBull, Rabet, Hana (Stellar).
      </p>
    </div>
  )
}

export default Unauthenticated
