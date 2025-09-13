"use client"
import Link from "next/link"
import React, { ReactNode } from "react"

export const SpecialButton = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative cursor-pointer">
      <div className="absolute top-0 left-0 h-[50px] w-[50px] rounded-full bg-primary cursor-pointer"></div>
      <button className="w-[150px] h-[50px] bg-primary inline-flex items-center justify-center text-black rounded-full ml-[40px] cursor-pointer">
        {children}
      </button>
    </div>
  )
}
