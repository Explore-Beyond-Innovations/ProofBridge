"use client"

import React, { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import type { UnlockStage } from "@/hooks/useTrades"

interface StageDef {
  key: UnlockStage
  label: string
  hint: string
}

const STAGES: StageDef[] = [
  {
    key: "signing",
    label: "Sign the unlock request",
    hint: "Approve in your wallet to authorise the claim.",
  },
  {
    key: "proving",
    label: "Generating ZK proof",
    hint: "This is the slow one — usually 30 to 60 seconds. Keep this window open.",
  },
  {
    key: "submitting",
    label: "Submitting on-chain",
    hint: "Sending the unlock transaction to the destination chain.",
  },
  {
    key: "confirming",
    label: "Finalising",
    hint: "Waiting for the block to confirm your claim.",
  },
]

const stageIndex = (s: UnlockStage | null): number =>
  s ? STAGES.findIndex((d) => d.key === s) : -1

export const UnlockProgress: React.FC<{ stage: UnlockStage | null }> = ({
  stage,
}) => {
  const active = stageIndex(stage)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (stage !== "proving") {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [stage])

  if (active < 0) return null

  return (
    <div className="space-y-3 rounded-lg bg-grey-900/60 p-4">
      <div>
        <p className="text-sm font-semibold text-grey-50">Processing unlock</p>
        <p className="text-xs text-grey-300">
          Don&apos;t close this window until it finishes.
        </p>
      </div>
      <ul className="space-y-3">
        {STAGES.map((s, i) => {
          const done = i < active
          const current = i === active
          const upcoming = i > active
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 shrink-0 inline-flex items-center justify-center">
                {done ? (
                  <Check size={16} className="text-primary" />
                ) : current ? (
                  <Loader2
                    size={16}
                    className="animate-spin text-amber-500"
                  />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-grey-600" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    upcoming
                      ? "text-grey-500"
                      : current
                        ? "text-grey-50 font-medium"
                        : "text-grey-200"
                  }`}
                >
                  {s.label}
                  {current && s.key === "proving" && (
                    <span className="ml-2 font-mono text-xs text-amber-500">
                      {elapsed}s
                    </span>
                  )}
                </p>
                {current && (
                  <p className="mt-0.5 text-xs text-grey-300">{s.hint}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
