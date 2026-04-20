/** Thin compat layer over @proofbridge/evm-deploy — keeps the legacy import shape for run.ts + flows. */

import { ethers } from "ethers";

export {
  NonceTracker,
  MANAGER_ROLE,
  EVM_NATIVE_TOKEN_ADDRESS,
  evmAddressToBytes32,
} from "@proofbridge/evm-deploy";

// Flow-test type surface; callers don't need to know the shape comes from a manifest.
export interface EvmTokenDeployment {
  pairKey: string;
  name: string;
  symbol: string;
  address: string;
  kind: "ERC20" | "NATIVE";
  decimals: number;
  /** Non-null for ERC20s; null for the native sentinel. */
  contract: ethers.Contract | null;
}

export interface EvmContracts {
  verifier: ethers.Contract;
  merkleManager: ethers.Contract;
  wNativeToken: ethers.Contract;
  orderPortal: ethers.Contract;
  adManager: ethers.Contract;
  tokens: EvmTokenDeployment[];
  signer: ethers.Wallet;
  nonces: import("@proofbridge/evm-deploy").NonceTracker;
  addresses: {
    verifier: string;
    merkleManager: string;
    wNativeToken: string;
    orderPortal: string;
    adManager: string;
  };
}

/** Legacy alias for `attachContract` — flow tests call it as `getContract`. */
export { attachContract as getContract } from "@proofbridge/evm-deploy";
