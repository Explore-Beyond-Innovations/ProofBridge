"use client"
import React, { ReactNode } from "react"

interface Props
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  icon?: ReactNode
}

export const SpecialButton = ({ children, icon, type, ...props }: Props) => {
  return (
    <button type={type ?? "button"} className="relative cursor-pointer" {...props}>
      <div className="absolute top-0 md:left-0 left-3 md:h-[45px] h-[35px] md:w-[45px] w-[35px] rounded-full bg-primary text-black text-sm cursor-pointer items-center justify-center flex">
        {icon}
      </div>
      <div className="min-w-[150px] md:h-[45px] h-[35px] bg-primary inline-flex items-center justify-center text-black rounded-full ml-[40px] cursor-pointer gap-2">
        {children}
      </div>
    </button>
  )
}
