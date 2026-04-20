"use client"

import React, { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import type { TxStageDef } from "./tx-stages"

interface TxProgressProps {
  stages: TxStageDef[]
  stage: string | null
}

export const TxProgress: React.FC<TxProgressProps> = ({ stages, stage }) => {
  const active = stage ? stages.findIndex((s) => s.key === stage) : -1
  const activeDef = active >= 0 ? stages[active] : null
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!activeDef?.showTimer) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [activeDef])

  if (active < 0) return null

  return (
    <div className="space-y-3 rounded-lg bg-grey-900/60 p-4">
      <div>
        <p className="text-sm font-semibold text-grey-50">Processing</p>
        <p className="text-xs text-grey-300">
          Don&apos;t close this window until it finishes.
        </p>
      </div>
      <ul className="space-y-3">
        {stages.map((s, i) => {
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
                  {current && s.showTimer && (
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
