"use client"
import React from "react"
import { OnboardingStateProvider } from "@/hooks/useOnboarding"
import { OnboardingTour } from "./OnboardingTour"

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <OnboardingStateProvider>
      {children}
      <OnboardingTour />
    </OnboardingStateProvider>
  )
}
