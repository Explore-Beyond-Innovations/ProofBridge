"use client"
import React from "react"
import { Modal, Tooltip } from "antd"
import { Loader2, LogOut } from "lucide-react"
import type { ChainAdapter, ChainStatus } from "./types"

const shortAddress = (addr: string) =>
  `${addr.slice(0, 6)}…${addr.slice(-4)}`

const statusLabel: Record<ChainStatus, string> = {
  disconnected: "Not connected",
  connecting: "Connecting…",
  connected: "Sign in required",
  authenticated: "Signed in",
}

const rowStatusLabel = (adapter: ChainAdapter): string => {
  if (adapter.status === "connected" && adapter.requiresLink) {
    return "Link wallet required"
  }
  return statusLabel[adapter.status]
}

const statusDot: Record<ChainStatus, string> = {
  disconnected: "bg-grey-600",
  connecting: "bg-amber-400 animate-pulse",
  connected: "bg-amber-400",
  authenticated: "bg-primary",
}

const primaryBtn =
  "h-9 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-black transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"

const ghostBtn =
  "h-9 inline-flex items-center justify-center rounded-full border border-grey-700 px-3 text-sm text-grey-300 transition hover:border-red-500/60 hover:text-red-400"

const iconBtn =
  "h-9 w-9 inline-flex items-center justify-center rounded-full border border-grey-700 text-grey-400 transition hover:border-red-500/60 hover:text-red-400"

const ActionButton: React.FC<{
  adapter: ChainAdapter
  onActionLaunch: () => void
}> = ({ adapter, onActionLaunch }) => {
  const { status, connect, disconnect, signIn, isSigningIn } = adapter

  if (status === "disconnected") {
    return (
      <button
        type="button"
        onClick={() => {
          onActionLaunch()
          connect()
        }}
        className={primaryBtn}
      >
        Connect
      </button>
    )
  }

  if (status === "connecting") {
    return (
      <button type="button" disabled className={primaryBtn}>
        <Loader2 size={14} className="animate-spin" />
        Connecting…
      </button>
    )
  }

  if (status === "connected" && signIn) {
    const needsLink = adapter.requiresLink
    const idleLabel = needsLink ? "Link wallet" : "Sign in"
    const busyLabel = needsLink ? "Linking…" : "Signing…"
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onActionLaunch()
            signIn()
          }}
          disabled={isSigningIn}
          className={primaryBtn}
        >
          {isSigningIn ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {busyLabel}
            </>
          ) : (
            idleLabel
          )}
        </button>
        <Tooltip title="Disconnect">
          <button
            type="button"
            onClick={() => disconnect()}
            className={iconBtn}
            aria-label="Disconnect"
          >
            <LogOut size={14} />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => disconnect()} className={ghostBtn}>
      Disconnect
    </button>
  )
}

const AdapterRow: React.FC<{
  adapter: ChainAdapter
  onActionLaunch: () => void
}> = ({ adapter, onActionLaunch }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-grey-800 bg-grey-900/60 p-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={adapter.logo}
          alt={adapter.name}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{adapter.name}</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusDot[adapter.status]}`}
            />
            <span className="text-[11px] text-grey-400">
              {rowStatusLabel(adapter)}
            </span>
          </div>
          {adapter.address && (
            <div className="mt-0.5 font-mono text-xs text-grey-300 truncate">
              {shortAddress(adapter.address)}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end sm:justify-start shrink-0">
        <ActionButton adapter={adapter} onActionLaunch={onActionLaunch} />
      </div>
    </div>
  )
}

interface ConnectHubModalProps {
  open: boolean
  onClose: () => void
  adapters: ChainAdapter[]
  // Raise when the hub is opened on top of another antd Modal (default 1000)
  // so it doesn't render behind its parent.
  zIndex?: number
}

export const ConnectHubModal: React.FC<ConnectHubModalProps> = ({
  open,
  onClose,
  adapters,
  zIndex,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      zIndex={zIndex}
      title={<span className="text-base font-semibold">Connect wallets</span>}
      styles={{
        content: { background: "#121112", borderRadius: 16 },
        header: { background: "transparent", borderBottom: "none" },
      }}
    >
      <p className="mb-4 text-xs text-grey-400">
        ProofBridge works across multiple networks. Connect a wallet on each
        chain you want to bridge between, then sign in to start a session.
      </p>
      <div className="flex flex-col gap-2">
        {adapters.map((a) => (
          <AdapterRow key={a.id} adapter={a} onActionLaunch={onClose} />
        ))}
      </div>
      <p className="mt-4 text-[11px] text-grey-500 text-center">
        More chains coming soon · Starknet · Solana · Base
      </p>
    </Modal>
  )
}
