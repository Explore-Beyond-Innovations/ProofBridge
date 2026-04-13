import { ethers } from "ethers";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ethLocalnet } from "../../../apps/backend-relayer/src/providers/viem/ethers/localnet.js";

export type AddressLike = `0x${string}`;

export interface EthChainData {
  adManagerAddress: AddressLike;
  orderPortalAddress: AddressLike;
  merkleManagerAddress: AddressLike;
  verifierAddress: AddressLike;
  chainId: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: AddressLike;
}

export const makeEthClient = () =>
  createPublicClient({ chain: ethLocalnet, transport: http() });

async function tryTopUpViaRpc(addr: AddressLike, hexWei: string) {
  const ethRpc = process.env.ETHEREUM_RPC_URL ?? "http://localhost:9545";
  const provider = new ethers.JsonRpcProvider(ethRpc);

  try {
    await provider.send("anvil_setBalance", [addr, hexWei]);
    return true;
  } catch {
    // ignore
  }

  try {
    await provider.send("hardhat_setBalance", [addr, hexWei]);
    return true;
  } catch {
    // ignore
  }

  return false;
}

export async function fundEthAddress(
  client: PublicClient,
  to: AddressLike,
  minBalanceEther = "1.0",
): Promise<void> {
  const needed = parseEther(minBalanceEther);
  const current = await client.getBalance({ address: to });
  if (current >= needed) return;
  const missing = needed - current;

  const funderKey = process.env.FUNDER_KEY as `0x${string}` | undefined;

  if (funderKey) {
    const wallet = createWalletClient({
      chain: client.chain ?? ethLocalnet,
      transport: http(),
      account: privateKeyToAccount(funderKey),
    });

    const hash = await wallet.sendTransaction({ to, value: missing });
    await client.waitForTransactionReceipt({ hash });
    return;
  }

  const ok = await tryTopUpViaRpc(to, `0x${needed.toString(16)}`);
  if (!ok) {
    throw new Error(
      "Unable to fund address. Set FUNDER_KEY in env, or run against Anvil/Hardhat and allow *_setBalance.",
    );
  }

  const funded = await client.getBalance({ address: to });
  if (funded < needed) {
    throw new Error(`Unable to fund ${to} to ${minBalanceEther} ETH.`);
  }
}
