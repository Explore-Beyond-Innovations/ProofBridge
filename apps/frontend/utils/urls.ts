"use client"
import { Networks } from "@stellar/stellar-sdk"

export const urls = {
  API_URL: process.env.NEXT_PUBLIC_API_URL!,
  SIGN_DOMAIN: process.env.NEXT_PUBLIC_SIGN_DOMAIN!,
  SIGN_URI: process.env.NEXT_PUBLIC_SIGN_URI!,
  STELLAR_NETWORK_PASSPHRASE:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
}
