"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "#1b1819",
          "--normal-text": "#edebec",
          "--normal-border": "#262424",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!shadow-lg !rounded-lg",
          title: "!text-grey-50 !font-semibold",
          description: "!text-grey-300",
          actionButton:
            "!bg-[#7ba82a] !text-grey-1000 !font-semibold hover:!bg-[#8fc235]",
          cancelButton: "!bg-grey-700 !text-grey-100 hover:!bg-grey-600",
          closeButton:
            "!bg-grey-800 !text-grey-300 !border !border-grey-700 hover:!text-grey-50",
          error: "!bg-red-500/90 !text-white !border-red-600",
          success: "!bg-[#7ba82a] !text-grey-1000 !border-[#7ba82a]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
