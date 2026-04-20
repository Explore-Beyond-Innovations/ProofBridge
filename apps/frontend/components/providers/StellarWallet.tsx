"use client"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Networks,
  StellarWalletsKit,
  KitEventType,
} from "@creit.tech/stellar-wallets-kit"
import { urls } from "@/utils/urls"

const NETWORK_PASSPHRASE = urls.STELLAR_NETWORK_PASSPHRASE as Networks
// Restricted to Freighter only while we debug link/sign regressions across
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter"
// import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo"
// import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr"
// import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull"
// import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet"
// import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana"
interface StellarWalletContextValue {
  address: string | null
  networkPassphrase: string
  isConnecting: boolean
  isReady: boolean
  connect: () => Promise<string | null>
  disconnect: () => Promise<void>
  signTransaction: (
    xdr: string,
    networkPassphrase?: string,
  ) => Promise<string>
  signMessage: (message: string) => Promise<string>
}

const StellarWalletContext = createContext<StellarWalletContextValue | null>(
  null,
)

const STORAGE_ADDRESS_KEY = "stellar_wallet_address"
const STORAGE_WALLET_KEY = "stellar_wallet_id"

export const StellarWalletProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const cachedWallet =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_WALLET_KEY) ?? undefined
        : undefined

    StellarWalletsKit.init({
      network: NETWORK_PASSPHRASE,
      selectedWalletId: cachedWallet,
      modules: [
        new FreighterModule(),
        // new AlbedoModule(),
        // new LobstrModule(),
        // new xBullModule(),
        // new RabetModule(),
        // new HanaModule(),
      ],
    })

    const cached =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_ADDRESS_KEY)
        : null
    if (cached) setAddress(cached)

    const unsubState = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      ({ payload }) => {
        if (payload.address) {
          setAddress(payload.address)
          window.localStorage.setItem(STORAGE_ADDRESS_KEY, payload.address)
        }
      },
    )
    const unsubSelected = StellarWalletsKit.on(
      KitEventType.WALLET_SELECTED,
      ({ payload }) => {
        if (payload.id) {
          window.localStorage.setItem(STORAGE_WALLET_KEY, payload.id)
        }
      },
    )
    const unsubDisconnect = StellarWalletsKit.on(
      KitEventType.DISCONNECT,
      () => {
        setAddress(null)
        window.localStorage.removeItem(STORAGE_ADDRESS_KEY)
        window.localStorage.removeItem(STORAGE_WALLET_KEY)
      },
    )

    setIsReady(true)

    return () => {
      unsubState()
      unsubSelected()
      unsubDisconnect()
    }
  }, [])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const result = await new Promise<string | null>((resolve, reject) => {
        StellarWalletsKit.authModal({}).then(
          () => {
            StellarWalletsKit.getAddress().then(
              ({ address }) => resolve(address),
              reject,
            )
          },
          (err) => {
            if (err?.message?.toLowerCase?.().includes("closed")) resolve(null)
            else reject(err)
          },
        )
      })
      if (result) {
        setAddress(result)
        window.localStorage.setItem(STORAGE_ADDRESS_KEY, result)
      }
      return result
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect()
    } catch {
      // some modules don't implement disconnect — ignore
    }
    setAddress(null)
    window.localStorage.removeItem(STORAGE_ADDRESS_KEY)
    window.localStorage.removeItem(STORAGE_WALLET_KEY)
  }, [])

  const signTransaction = useCallback(
    async (xdr: string, networkPassphrase?: string) => {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: networkPassphrase ?? NETWORK_PASSPHRASE,
        address: address ?? undefined,
      })
      return signedTxXdr
    },
    [address],
  )

  const signMessage = useCallback(
    async (message: string) => {
      const { signedMessage } = await StellarWalletsKit.signMessage(message, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: address ?? undefined,
      })
      return signedMessage
    },
    [address],
  )

  const value = useMemo<StellarWalletContextValue>(
    () => ({
      address,
      networkPassphrase: NETWORK_PASSPHRASE,
      isConnecting,
      isReady,
      connect,
      disconnect,
      signTransaction,
      signMessage,
    }),
    [
      address,
      isConnecting,
      isReady,
      connect,
      disconnect,
      signTransaction,
      signMessage,
    ],
  )

  return (
    <StellarWalletContext.Provider value={value}>
      {children}
    </StellarWalletContext.Provider>
  )
}

export const useStellarWallet = () => {
  const ctx = useContext(StellarWalletContext)
  if (!ctx) {
    throw new Error(
      "useStellarWallet must be used inside <StellarWalletProvider>",
    )
  }
  return ctx
}
