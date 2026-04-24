"use client"
import React from "react"
import { Button } from "antd"
import { HelpCircle } from "lucide-react"
import { useOnboarding } from "@/hooks/useOnboarding"
import type { FlowName } from "@/lib/onboarding/steps"

interface Props {
  flow: FlowName
  label?: string
  size?: "small" | "middle" | "large"
  className?: string
}

export const PageTourButton: React.FC<Props> = ({
  flow,
  label = "Tour this page",
  size = "small",
  className,
}) => {
  const { startTour } = useOnboarding()
  return (
    <Button
      type="default"
      size={size}
      icon={<HelpCircle size={14} />}
      onClick={() => startTour(flow)}
      className={className}
    >
      {label}
    </Button>
  )
}
