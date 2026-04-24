"use client"

export type OnboardingEvent =
  | { type: "hub:opened" }
  | { type: "wallet:authenticated" }
  | { type: "faucet:claimed" }
  | { type: "bridge:route-chosen" }

const EVENT_NAME = "pb:onboarding"

export const emitOnboarding = (event: OnboardingEvent): void => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }))
}

export const subscribeOnboarding = (
  handler: (event: OnboardingEvent) => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {}
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<OnboardingEvent>).detail
    if (detail) handler(detail)
  }
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
