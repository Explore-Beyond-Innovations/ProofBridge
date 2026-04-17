"use client"
import React, { useEffect, useState } from "react"
import Cookies from "js-cookie"
import { Wallet } from "lucide-react"
import { useAdapters } from "./useAdapters"
import { ConnectHubModal } from "./ConnectHubModal"

const shortAddress = (addr: string) =>
  `${addr.slice(0, 4)}…${addr.slice(-4)}`

export const ConnectWalletButton = () => {
  const adapters = useAdapters()
  const [open, setOpen] = useState(false)

  // Adapters read cookies and wallet-connection state synchronously, which
  // differs between SSR (no cookies, no wagmi store) and the first client
  // render. Gate dynamic UI behind a mount flag so hydration matches.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // If every adapter ends up disconnected while a session still exists (e.g.
  // user disconnected from both wallet extensions, or revoked site access),
  // wipe the auth cookies so the protected layout renders Unauthenticated.
  // Debounced to let wagmi / stellar-wallets-kit rehydrate on page load
  // before deciding nothing is connected.
  useEffect(() => {
    if (!mounted) return
    const anyLive = adapters.some(
      (a) => a.address || a.status === "connecting",
    )
    if (anyLive) return
    if (!Cookies.get("auth_token") && !Cookies.get("refresh_token")) return
    const t = setTimeout(() => {
      Cookies.remove("auth_token")
      Cookies.remove("refresh_token")
      window.location.reload()
    }, 800)
    return () => clearTimeout(t)
  }, [mounted, adapters])

  const active = mounted ? adapters.filter((a) => a.address) : []
  const anyAuthed =
    mounted && adapters.some((a) => a.status === "authenticated")
  const anyNeedsSign =
    mounted && adapters.some((a) => a.status === "connected")
  const anyNeedsLink =
    mounted &&
    adapters.some((a) => a.status === "connected" && a.requiresLink)

  const buttonLabel = (() => {
    if (active.length === 0) return "Connect Wallet"
    if (active.length === 1) return shortAddress(active[0].address!)
    return `${active.length} wallets`
  })()

  const ringClass = anyAuthed
    ? "ring-1 ring-primary/60"
    : anyNeedsSign
      ? "ring-1 ring-amber-400/60"
      : ""

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group h-10 inline-flex items-center gap-2 rounded-full border border-grey-800 bg-grey-900/60 px-3 text-sm font-medium text-grey-100 backdrop-blur transition hover:border-primary/60 hover:bg-grey-800/60 ${ringClass}`}
      >
        {active.length > 0 ? (
          <span className="flex -space-x-1.5">
            {active.map((a) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={a.id}
                src={a.logo}
                alt={a.name}
                className="h-5 w-5 rounded-full ring-2 ring-grey-900"
              />
            ))}
          </span>
        ) : (
          <Wallet size={16} className="text-grey-300" />
        )}
        <span className="hidden sm:inline">{buttonLabel}</span>
        {anyNeedsSign && !anyAuthed && (
          <span className="hidden md:inline text-[11px] font-semibold text-amber-400">
            · sign in
          </span>
        )}
        {anyNeedsLink && anyAuthed && (
          <span className="hidden md:inline text-[11px] font-semibold text-amber-400">
            · link wallet
          </span>
        )}
      </button>

      <ConnectHubModal
        open={open}
        onClose={() => setOpen(false)}
        adapters={adapters}
      />
    </>
  )
}
