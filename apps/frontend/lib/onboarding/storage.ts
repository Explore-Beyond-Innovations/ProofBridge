"use client"

export const ONBOARDING_STORAGE_KEY = "pb_onboarding_v1"

export interface OnboardingState {
  version: 1
  completed: boolean
  skipped: boolean
  lastStep: number
}

const DEFAULT: OnboardingState = {
  version: 1,
  completed: false,
  skipped: false,
  lastStep: 0,
}

export const readOnboarding = (): OnboardingState => {
  if (typeof window === "undefined") return DEFAULT
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    if (parsed.version !== 1) return DEFAULT
    return { ...DEFAULT, ...parsed, version: 1 }
  } catch {
    return DEFAULT
  }
}

export const writeOnboarding = (patch: Partial<OnboardingState>): void => {
  if (typeof window === "undefined") return
  try {
    const next: OnboardingState = { ...readOnboarding(), ...patch, version: 1 }
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // swallow — localStorage can be blocked (private mode, quota)
  }
}

export const resetOnboarding = (): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch {
    // swallow
  }
}
