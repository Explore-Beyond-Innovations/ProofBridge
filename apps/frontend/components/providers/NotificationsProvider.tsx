"use client"
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { io, Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { urls } from "@/utils/urls"
import { INotification } from "@/types/notifications"
import {
  NOTIFICATIONS_LIST_KEY,
  NOTIFICATIONS_UNREAD_COUNT_KEY,
} from "@/hooks/useNotifications"
import { useAuthToken } from "@/hooks/useAuthToken"

interface NotificationsContextValue {
  connected: boolean
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
)

export const NotificationsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const token = useAuthToken()

  useEffect(() => {
    if (!token) {
      // No auth → tear down any stale socket.
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setConnected(false)
      return
    }

    const socket = io(`${urls.API_URL}/notifications`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY })
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY,
      })
    })

    socket.on("disconnect", () => {
      setConnected(false)
    })

    socket.on("notification", (payload: INotification) => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY })
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY,
      })
      toast(payload.title, {
        description: payload.body,
        action: payload.tradeId
          ? {
            label: "View",
            onClick: () =>
              router.push(`/orders?highlight=${payload.tradeId}`),
          }
          : undefined,
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, queryClient, router])

  const value = useMemo(() => ({ connected }), [connected])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotificationsSocket = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error(
      "useNotificationsSocket must be used within NotificationsProvider",
    )
  }
  return ctx
}
