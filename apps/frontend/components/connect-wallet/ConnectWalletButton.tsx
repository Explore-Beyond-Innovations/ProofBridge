"use client"
import React from "react"
import Cookies from "js-cookie"
import { Button, Dropdown } from "antd"
import type { MenuProps } from "antd"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { ChevronDown, LogOut } from "lucide-react"
import { useStellarWallet } from "@/components/providers/StellarWallet"
import { useStellarLogin } from "@/hooks/useStellarAuth"

const shortAddress = (addr: string) =>
  `${addr.slice(0, 4)}…${addr.slice(-4)}`

const StellarConnect = () => {
  const { address, connect, disconnect, isConnecting } = useStellarWallet()
  const login = useStellarLogin()

  const authed = Boolean(Cookies.get("auth_token"))

  if (!address) {
    return (
      <Button type="primary" loading={isConnecting} onClick={() => connect()}>
        Connect Stellar
      </Button>
    )
  }

  if (!authed) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="primary"
          loading={login.isPending}
          onClick={() => login.mutate()}
        >
          Sign in ({shortAddress(address)})
        </Button>
        <Button
          size="small"
          icon={<LogOut size={12} />}
          onClick={() => disconnect()}
        />
      </div>
    )
  }

  const items: MenuProps["items"] = [
    {
      key: "disconnect",
      label: "Disconnect",
      onClick: async () => {
        await disconnect()
        Cookies.remove("auth_token")
        Cookies.remove("refresh_token")
        window.location.reload()
      },
    },
  ]
  return (
    <Dropdown menu={{ items }} placement="bottomRight">
      <Button>
        {shortAddress(address)} <ChevronDown size={14} />
      </Button>
    </Dropdown>
  )
}

export const ConnectWalletButton = () => {
  return (
    <div className="flex items-center gap-2">
      <ConnectButton />
      <StellarConnect />
    </div>
  )
}
