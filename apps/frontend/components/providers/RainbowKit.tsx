"use client"
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import React from "react"
import { sepolia } from "viem/chains"

export const RainbowKit = ({ children }: { children: React.ReactNode }) => {
  return (
    <RainbowKitProvider
      initialChain={sepolia}
      theme={darkTheme({
        accentColor: "#c3ff49",
        accentColorForeground: "#000",
      })}
    >
      {children}
    </RainbowKitProvider>
  )
}
