import {
  hederaTestnet,
  optimismSepolia,
  polygonAmoy,
  sepolia,
} from "viem/chains"
import { STELLAR_TESTNET_CHAIN_ID } from "./chains"

export const chain_icons: Record<string, string> = {
  [sepolia.id]: "/assets/logos/eth.svg",
  [STELLAR_TESTNET_CHAIN_ID]: "/assets/logos/stellar-logo.svg",
  [hederaTestnet.id]: "/assets/logos/hbar.png",
  [polygonAmoy.id]: "/assets/logos/hbar.png",
  [optimismSepolia.id]: "/assets/logos/hbar.png",
}
