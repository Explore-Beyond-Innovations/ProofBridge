"use client"
import React from "react"
import dynamic from "next/dynamic"
import { useOnboarding } from "@/hooks/useOnboarding"

const Joyride = dynamic(
  () => import("react-joyride").then((m) => m.Joyride),
  { ssr: false },
) as unknown as React.ComponentType<
  Parameters<typeof import("react-joyride").Joyride>[0]
>

export const OnboardingTour: React.FC = () => {
  const { steps, run, stepIndex, onEvent } = useOnboarding()

  if (!steps.length) return null

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      onEvent={onEvent}
      options={{
        zIndex: 2100,
        primaryColor: "#c3ff49",
        backgroundColor: "#121112",
        textColor: "#edebec",
        arrowColor: "#121112",
        overlayColor: "rgba(0, 0, 0, 0.65)",
        skipScroll: true,
        overlayClickAction: false,
        skipBeacon: true,
        buttons: ["back", "skip", "primary"],
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          border: "1px solid #262424",
          padding: 16,
          fontSize: 14,
        },
        tooltipTitle: {
          fontSize: 15,
          fontWeight: 600,
          color: "#edebec",
        },
        tooltipContent: {
          padding: "8px 0",
        },
        buttonPrimary: {
          backgroundColor: "#c3ff49",
          color: "#0b090a",
          borderRadius: 999,
          padding: "6px 16px",
          fontSize: 13,
          fontWeight: 600,
        },
        buttonBack: {
          color: "#b8b2b3",
          fontSize: 13,
          marginRight: 8,
        },
        buttonSkip: {
          color: "#797072",
          fontSize: 12,
        },
        buttonClose: {
          color: "#797072",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  )
}
