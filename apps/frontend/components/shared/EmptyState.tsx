"use client"
import React from "react"
import Link from "next/link"
import { Button } from "antd"
import { Logo } from "./Logo"

type SecondaryAction = {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

type PrimaryAction =
  | { actionLabel: string; onAction: () => void; actionHref?: undefined }
  | { actionLabel: string; actionHref: string; onAction?: undefined }
  | { actionLabel?: undefined; onAction?: undefined; actionHref?: undefined }

export type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  secondaryAction?: SecondaryAction
  size?: "sm" | "md"
  className?: string
  "data-tour"?: string
} & PrimaryAction

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  secondaryAction,
  size = "md",
  className,
  ...rest
}) => {
  const padding = size === "sm" ? "py-6" : "py-16"
  const iconWrap =
    size === "sm"
      ? "h-14 w-14 rounded-full bg-grey-800 flex items-center justify-center"
      : "h-24 w-24 rounded-full bg-grey-800 flex items-center justify-center"
  const titleCls =
    size === "sm" ? "text-base font-semibold" : "text-xl font-semibold"
  const descCls =
    size === "sm"
      ? "text-xs text-grey-400 max-w-md"
      : "text-grey-400 max-w-md"

  const resolvedIcon = icon ?? (
    <div className="opacity-20">
      <Logo />
    </div>
  )

  const primary = actionLabel ? (
    actionHref ? (
      <Link href={actionHref}>
        <Button type="primary">{actionLabel}</Button>
      </Link>
    ) : (
      <Button type="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    )
  ) : null

  return (
    <div
      className={`flex flex-col items-center justify-center ${padding} space-y-4 ${className ?? ""}`}
      data-tour={rest["data-tour"]}
    >
      <div className={iconWrap}>{resolvedIcon}</div>

      <div className="text-center space-y-2">
        <h3 className={titleCls}>{title}</h3>
        {description ? <p className={descCls}>{description}</p> : null}
      </div>

      {(primary || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
          {primary}
          {secondaryAction && (
            <Button
              type="text"
              onClick={secondaryAction.onClick}
              icon={secondaryAction.icon}
              className="!text-amber-300 hover:!text-amber-200"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default EmptyState
