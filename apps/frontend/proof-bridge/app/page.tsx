import { About } from "@/components/landing/About"
import { Features } from "@/components/landing/Features"
import { Hero } from "@/components/landing/Hero"
import { Header } from "@/components/shared/Header"
import Image from "next/image"

export default function Home() {
  return (
    <div className="relative">
      <Header />
      <Hero />
      <div className="header-anime h-4"></div>
      <About />
      <Features />
    </div>
  )
}
