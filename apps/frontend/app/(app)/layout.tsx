import { Header } from "@/components/shared/Header"
import { SideBar } from "@/components/shared/SideBar"
import { NotificationsProvider } from "@/components/providers/NotificationsProvider"
import React from "react"

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <NotificationsProvider>
      <main className="relative min-h-screen">
        <div className="h-[300px] w-[300px] rounded-full bg-primary/30 fixed -top-[100px] -left-[100px] blur-[150px]"></div>
        <Header />
        <div className="md:grid md:[grid-template-columns:250px_1fr]">
          <SideBar />
          <div className="md:pt-[96px] pt-[76px] md:px-5">{children}</div>
        </div>
      </main>
    </NotificationsProvider>
  )
}
