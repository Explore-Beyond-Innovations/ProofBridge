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

export const AdsEmptyState: React.FC<Props> = ({
  title = "No ads yet",
  message = "You currently have no ads. Create a new ad to have active listings.",
  primaryLabel = "Create an ad",
  onPrimaryClick,
}) => {
  return (
    <EmptyState
      icon={<CiBadgeDollar size={36} className="text-primary" />}
      title={title}
      description={message}
      actionLabel={primaryLabel}
      {...(onPrimaryClick
        ? { onAction: onPrimaryClick }
        : { actionHref: "/ads-management/create" })}
    />
  )
}

export default AdsEmptyState
