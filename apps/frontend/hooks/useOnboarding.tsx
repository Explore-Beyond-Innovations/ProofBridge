"use client"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Controls, EventData } from "react-joyride"
import { useAdapters } from "@/components/connect-wallet/useAdapters"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useAuthToken } from "@/hooks/useAuthToken"
import {
  FLOWS,
  FLOW_ROUTES,
  stepIndexBySlug,
  type FlowName,
  type OnboardingStep,
} from "@/lib/onboarding/steps"
import {
  readOnboarding,
  resetOnboarding,
  writeOnboarding,
} from "@/lib/onboarding/storage"
import { subscribeOnboarding } from "@/lib/onboarding/events"

interface OnboardingContextValue {
  activeFlow: FlowName | null
  steps: OnboardingStep[]
  run: boolean
  stepIndex: number
  startTour: (flow?: FlowName) => void
  skipTour: () => void
  completeTour: () => void
  onEvent: (data: EventData, controls: Controls) => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export const useOnboarding = (): OnboardingContextValue => {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    // Fallback no-op for callers outside the provider (landing pages etc.)
    return {
      activeFlow: null,
      steps: [],
      run: false,
      stepIndex: 0,
      startTour: () => { },
      skipTour: () => { },
      completeTour: () => { },
      onEvent: () => { },
    }
  }
  return ctx
}

export const OnboardingStateProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const pathname = usePathname()
  const router = useRouter()
  const adapters = useAdapters()
  const { data: currentUser } = useCurrentUser()
  const authToken = useAuthToken()

  const [activeFlow, setActiveFlow] = useState<FlowName | null>(null)
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const autoStartedRef = useRef(false)

  const steps = useMemo<OnboardingStep[]>(
    () => (activeFlow ? FLOWS[activeFlow] : []),
    [activeFlow],
  )

  const currentStep = steps[stepIndex]
  const currentRoute = currentStep?.route

  useEffect(() => {
    if (autoStartedRef.current) return
    if (authToken && currentUser === undefined) return
    autoStartedRef.current = true
    const s = readOnboarding()
    if (s.completed || s.skipped) return
    if (currentUser?.wallets?.length) return
    setActiveFlow("onboarding")
    setStepIndex(s.lastStep || 0)
    setRun(true)
  }, [authToken, currentUser])

  useEffect(() => {
    if (!currentStep) return
    if (!currentRoute) return
    if (pathname === currentRoute) {
      if (!run) setRun(true)
    } else if (run) {
      setRun(false)
    }
  }, [pathname, currentRoute, currentStep, run])

  const persistIndex = useCallback(
    (idx: number) => {
      if (activeFlow === "onboarding") writeOnboarding({ lastStep: idx })
    },
    [activeFlow],
  )

  const goToStep = useCallback(
    (idx: number) => {
      if (!activeFlow) return
      if (idx < 0 || idx >= FLOWS[activeFlow].length) return
      setStepIndex(idx)
      persistIndex(idx)
      const route = FLOWS[activeFlow][idx].route
      if (route && pathname !== route) {
        setRun(false)
        router.push(route)
      } else {
        setRun(true)
      }
    },
    [activeFlow, pathname, router, persistIndex],
  )

  const advanceToSlug = useCallback(
    (slug: string) => {
      if (activeFlow !== "onboarding") return
      const target = stepIndexBySlug("onboarding", slug)
      if (target < 0) return
      if (target <= stepIndex) return
      goToStep(target)
    },
    [activeFlow, goToStep, stepIndex],
  )

  // Event bridge — other screens emit signals to advance the onboarding flow.
  useEffect(() => {
    return subscribeOnboarding((event) => {
      switch (event.type) {
        case "hub:opened":
          advanceToSlug("connect-hub-modal")
          break
        case "wallet:authenticated":
          advanceToSlug("sidebar-faucet")
          break
        case "faucet:claimed":
          advanceToSlug("bridge-source")
          break
        case "bridge:route-chosen":
          advanceToSlug("bridge-ads-list")
          break
      }
    })
  }, [advanceToSlug])

  useEffect(() => {
    if (activeFlow !== "onboarding") return
    const anyAuthed = adapters.some((a) => a.status === "authenticated")
    if (anyAuthed && stepIndex < stepIndexBySlug("onboarding", "sidebar-faucet")) {
      advanceToSlug("sidebar-faucet")
    }
  }, [adapters, stepIndex, advanceToSlug, activeFlow])

  const startTour = useCallback(
    (flow: FlowName = "onboarding") => {
      if (flow === "onboarding") {
        resetOnboarding()
        writeOnboarding({ lastStep: 0 })
      }
      setActiveFlow(flow)
      setStepIndex(0)
      setRun(true)
      const firstRoute = FLOWS[flow][0]?.route ?? FLOW_ROUTES[flow]
      if (firstRoute && pathname !== firstRoute) {
        setRun(false)
        router.push(firstRoute)
      }
    },
    [pathname, router],
  )

  const skipTour = useCallback(() => {
    if (activeFlow === "onboarding") writeOnboarding({ skipped: true })
    setRun(false)
    setActiveFlow(null)
  }, [activeFlow])

  const completeTour = useCallback(() => {
    if (activeFlow === "onboarding") writeOnboarding({ completed: true })
    setRun(false)
    setActiveFlow(null)
  }, [activeFlow])

  const onEvent = useCallback(
    (data: EventData) => {
      const { action, index, status, type } = data
      if (status === "skipped" || action === "skip") {
        skipTour()
        return
      }
      if (status === "finished") {
        completeTour()
        return
      }
      if (type === "step:after") {
        if (action === "next") {
          if (index + 1 >= steps.length) {
            completeTour()
            return
          }
          goToStep(index + 1)
        } else if (action === "prev") {
          goToStep(index - 1)
        } else if (action === "close") {
          skipTour()
        }
      }
      if (type === "error:target_not_found") {
        // Pause and let the route/event system bring the target into view.
        setRun(false)
      }
    },
    [goToStep, skipTour, completeTour, steps.length],
  )

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activeFlow,
      steps,
      run,
      stepIndex,
      startTour,
      skipTour,
      completeTour,
      onEvent,
    }),
    [activeFlow, steps, run, stepIndex, startTour, skipTour, completeTour, onEvent],
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}
