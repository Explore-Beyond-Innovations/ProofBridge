"use client"
import React, { useState } from "react"
import { Badge, Button, Popover, Spin } from "antd"
import { Bell, CheckCheck } from "lucide-react"
import moment from "moment"
import { useRouter } from "next/navigation"
import {
  useGetAllNotifications,
  useGetUnreadCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/hooks/useNotifications"
import { useAuthToken } from "@/hooks/useAuthToken"
import { INotification, NotificationType } from "@/types/notifications"

const TYPE_LABEL: Record<NotificationType, string> = {
  TRADE_CREATED: "New order",
  TRADE_LOCKED: "Order locked",
  BRIDGER_CLAIMED: "Bridger claimed",
}

const NotificationRow: React.FC<{
  item: INotification
  onView: (item: INotification) => void
}> = ({ item, onView }) => {
  return (
    <button
      onClick={() => onView(item)}
      className={`w-full text-left p-3 rounded-md border transition-colors ${item.read
          ? "bg-grey-900 border-grey-800 hover:border-grey-700"
          : "bg-grey-900 border-primary/40 hover:border-primary/70"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!item.read && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
            <p className="text-xs text-primary font-semibold uppercase tracking-wider">
              {TYPE_LABEL[item.type] ?? item.type}
            </p>
          </div>
          <p className="text-sm text-grey-50 mt-1 truncate">{item.title}</p>
          <p className="text-xs text-grey-400 mt-1 line-clamp-2">{item.body}</p>
        </div>
        <span className="text-[11px] text-grey-500 whitespace-nowrap flex-shrink-0">
          {moment(item.createdAt).fromNow()}
        </span>
      </div>
    </button>
  )
}

const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router = useRouter()
  const { data, isLoading } = useGetAllNotifications({ limit: 20 })
  const { mutateAsync: markRead } = useMarkNotificationRead()
  const { mutateAsync: markAllRead, isPending: markingAll } =
    useMarkAllNotificationsRead()

  const items = data?.items ?? []
  const hasUnread = items.some((n) => !n.read)

  const handleView = async (item: INotification) => {
    if (!item.read) {
      try {
        await markRead(item.id)
      } catch {
        // error handled by hook toast
      }
    }
    onClose()
    if (item.tradeId) {
      router.push(`/orders?highlight=${item.tradeId}`)
    }
  }

  return (
    <div className="w-[340px] max-w-[92vw]">
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-grey-800">
        <p className="text-sm font-semibold text-grey-50">Notifications</p>
        <Button
          type="text"
          size="small"
          onClick={() => {
            if (!hasUnread) return
            void markAllRead()
          }}
          disabled={!hasUnread || markingAll}
          icon={<CheckCheck size={14} />}
          className="!text-xs !text-grey-300 hover:!text-primary"
        >
          Mark all read
        </Button>
      </div>
      <div className="max-h-[360px] overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spin size="small" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-grey-400">
            You&apos;re all caught up.
          </div>
        ) : (
          items.map((item) => (
            <NotificationRow key={item.id} item={item} onView={handleView} />
          ))
        )}
      </div>
    </div>
  )
}

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false)
  const token = useAuthToken()
  const { data: unreadCount = 0 } = useGetUnreadCount()
  if (!token) return null

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      content={<NotificationPanel onClose={() => setOpen(false)} />}
      styles={{
        body: {
          padding: 0,
          background: "#121112",
          border: "1px solid var(--color-grey-800, #242424)",
          borderRadius: 12,
        },
      }}
    >
      <button
        type="button"
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-full border border-grey-800 bg-grey-900 hover:border-primary/60 transition-colors"
      >
        <Badge
          count={unreadCount}
          overflowCount={99}
          size="small"
          offset={[2, -2]}
        >
          <Bell size={16} className="text-grey-200" />
        </Badge>
      </button>
    </Popover>
  )
}
