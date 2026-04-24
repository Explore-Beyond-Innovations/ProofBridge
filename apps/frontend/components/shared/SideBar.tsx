"use client"
import { app_routes } from "@/lib/routes"
import Link from "next/link"
import React from "react"
import { usePathname } from "next/navigation"

interface SideBarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export const SideBar = ({ mobileOpen, onClose }: SideBarProps) => {
  const pathname = usePathname()

  const navContent = (
    <div className="">
      {app_routes.map((route) => {
        const isActive = pathname.includes(route.path)
        const sideBarAnchor =
          route.path === "/faucet"
            ? "sidebar-faucet"
            : route.path === "/ads-management/create"
              ? "sidebar-create-ad"
              : undefined
        return (
          <Link
            href={route.path}
            key={route.path}
            onClick={onClose}
            data-tour={sideBarAnchor}
          >
            <div
              className={`${
                isActive
                  ? "bg-grey-700 text-grey-0 font-medium"
                  : "text-grey-300"
              } flex items-center gap-4 capitalize md:px-8 p-4 text-sm relative mb-2 hover:bg-night transition-colors duration-200`}
            >
              {route.icon}
              <p>{route.label}</p>

              {isActive && (
                <div className="w-[4px] h-[16px] bg-primary rounded-2xl absolute right-6 top-[50%] -translate-y-[50%] shadow-primary shadow-sm drop-shadow-primary drop-shadow-md" />
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 left-0 h-screen w-full pt-[126px] to-grey-1000 from-grey-900/50 bg-gradient-to-b border-r border-r-grey-900 md:block hidden">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[25] transition-opacity duration-300 ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Mobile slide-out drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-screen w-[280px] pt-[80px] to-grey-1000 from-grey-900 bg-gradient-to-b border-r border-r-grey-900 z-[30] transform transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  )
}
