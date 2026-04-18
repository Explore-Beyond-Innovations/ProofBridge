import React from "react"
import { Logo } from "../shared/Logo"
import moment from "moment"
import Link from "next/link"
import { FaGithub } from "react-icons/fa"
import { FaXTwitter } from "react-icons/fa6"

export const Footer = () => {
  return (
    <footer className="px-4 md:px-20 py-4 md:py-5 flex items-center gap-4 justify-between md:flex-row flex-col">
      <div className="flex items-center gap-1">
        <Logo />
        <p>ProofBrige</p>
      </div>

      <div>&copy; {moment().year()}</div>

      <div className="flex items-center gap-4">
        <Link href={"https://github.com/JoE11-y/ProofBridge"} target="_blank">
          <FaGithub size={24} />
        </Link>

        <Link href={""} target="_blank">
          <FaXTwitter size={24} />
        </Link>
      </div>
    </footer>
  )
}
