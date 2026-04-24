"use client"
import React from "react"
import { CiBadgeDollar } from "react-icons/ci"
import { EmptyState } from "@/components/shared/EmptyState"

interface Props {
  title?: string
  message?: string
  primaryLabel?: string
  onPrimaryClick?: () => void
}

const ICON = <CiBadgeDollar size={36} className="text-primary" />

export const AdsEmptyState: React.FC<Props> = ({
  title = "No ads yet",
  message = "You currently have no ads. Create a new ad to have active listings.",
  primaryLabel,
  onPrimaryClick,
}) => {
  if (onPrimaryClick) {
    return (
      <EmptyState
        icon={ICON}
        title={title}
        description={message}
        actionLabel={primaryLabel ?? "Refresh"}
        onAction={onPrimaryClick}
      />
    )
  }
  return (
    <EmptyState
      icon={ICON}
      title={title}
      description={message}
      actionLabel="Create an ad"
      actionHref="/ads-management/create"
    />
  )
}

export default AdsEmptyState
