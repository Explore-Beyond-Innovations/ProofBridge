// ----------------------------
// Proofbridge domain typed data

import { getBytes } from "ethers";

// ----------------------------
export const domain = {
  name: "Proofbridge",
  version: "1",
};

// ----------------------------
// OrderPortal typed data
// ----------------------------
export const orderTypes: Record<string, { name: string; type: string }[]> = {
  Order: [
    { name: "orderChainToken", type: "address" },
    { name: "adChainToken", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "bridger", type: "address" },
    { name: "orderChainId", type: "uint256" },
    { name: "orderPortal", type: "address" },
    { name: "orderRecipient", type: "address" },
    { name: "adChainId", type: "uint256" },
    { name: "adManager", type: "address" },
    { name: "adId", type: "uint256" },
    { name: "adCreator", type: "address" },
    { name: "adRecipient", type: "address" },
    { name: "salt", type: "uint256" },
  ],
};

export interface OrderTypedData {
  orderChainToken: string;
  adChainToken: string;
  amount: string;
  bridger: string;
  orderChainId: string;
  orderPortal: string;
  orderRecipient: string;
  adChainId: string;
  adManager: string;
  adId: string;
  adCreator: string;
  adRecipient: string;
  salt: string;
}

export function hexToArr(hex: string, isSignature = false): Array<number> {
  const bytes = getBytes(hex);
  if (isSignature) {
    if (bytes.length === 65) return Array.from(bytes.slice(0, 64)); // drop v
    if (bytes.length !== 64)
      throw new Error(`Expected 64/65 bytes, got ${bytes.length}`);
  }
  return Array.from(bytes);
}
