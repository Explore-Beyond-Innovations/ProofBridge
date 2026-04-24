"use client"
import React from "react"
import { Tooltip } from "antd"
import { HelpCircle } from "lucide-react"
import { useOnboarding } from "@/hooks/useOnboarding"

export const ReplayTourButton: React.FC = () => {
  const { startTour } = useOnboarding()
  return (
    <Tooltip title="Replay tour">
      <button
        type="button"
        aria-label="Replay onboarding tour"
        onClick={() => startTour("onboarding")}
        data-tour="header-replay-tour"
        className="w-9 h-9 flex items-center justify-center rounded-full border border-grey-800 bg-grey-900 hover:border-primary/60 transition-colors"
      >
        <HelpCircle size={16} className="text-grey-200" />
      </button>
    </Tooltip>
  )
}
