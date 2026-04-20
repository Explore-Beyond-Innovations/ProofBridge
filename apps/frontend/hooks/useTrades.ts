import { ORDER_PORTAL_ABI } from "@/abis/orderPortal.abi";
import {
  confirmTradeTx,
  confirmUnlockFunds,
  createTrade,
  getAllTrades,
  getTradeParams,
  lockFunds,
  unlockFunds,
} from "@/services/trades.service";
import {
  IAdManagerOrderParams,
  ICreateTradeRequest,
  IGetTradesParams,
  IOrderPortalOrderParams,
} from "@/types/trades";
import { config } from "@/utils/wagmi-config";
import { useMutation, useQuery } from "@tanstack/react-query";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useWriteContract, useSignTypedData } from "wagmi";
import { toast } from "sonner";
import { ERC20_ABI } from "@/abis/ERC20.abi";
import { getSingleToken } from "@/services/tokens.service";
import { AD_MANAGER_ABI } from "@/abis/AdManager.abi";
import { formatUnits, parseEther } from "viem";
import { useStellarAdapter } from "@/lib/stellar-adapter";
import { useStellarWallet } from "@/components/providers/StellarWallet";
import {
  createOrderSoroban,
  lockForOrderSoroban,
  unlockOrderPortalSoroban,
  unlockSoroban,
} from "@/utils/stellar/actions";
import { establishTrustline, hasTrustline } from "@/utils/stellar/trustline";
import type { TrustlineCtx } from "@/utils/stellar/trustline";
import type { IToken } from "@/types/tokens";
import { hex32ToAddress20 } from "@/utils/evm/address";
import { buildStellarUnlockMessage } from "@/utils/stellar/unlock-message";

async function ensureSacTrustline(
  token: IToken,
  ctx: TrustlineCtx,
): Promise<void> {
  if (token.kind !== "SAC") return;
  if (!token.assetIssuer) {
    throw new Error(
      `Token ${token.symbol} is marked SAC but has no assetIssuer configured`,
    );
  }
  const ok = await hasTrustline(
    ctx.signerPublicKey,
    token.symbol,
    token.assetIssuer,
    ctx.horizonUrl,
  );
  if (ok) return;
  toast.info(`Establishing trustline for ${token.symbol}…`);
  await establishTrustline(ctx, token.symbol, token.assetIssuer);
}

export const useCreateTrade = () => {
  const { writeContractAsync } = useWriteContract();
  const { buildCtx: buildStellarCtx, buildTrustlineCtx } = useStellarAdapter();
  return useMutation({
    mutationKey: ["create-trade"],
    mutationFn: async (data: {
      payload: ICreateTradeRequest;
      orderTokenId: string;
    }) => {
      const response = await createTrade(data.payload);
      const rc = response.reqContractDetails;

      if (rc.chainKind === "STELLAR") {
        const orderToken = await getSingleToken(data.orderTokenId);
        await ensureSacTrustline(orderToken, buildTrustlineCtx());
        const txHash = await createOrderSoroban(
          buildStellarCtx(),
          {
            signatureHex: rc.signature,
            signerPublicKeyHex: rc.signerPublicKey!,
            authTokenHex: rc.authToken,
            timeToExpire: rc.timeToExpire,
          },
          {
            orderParams: {
              orderChainToken: rc.orderParams.orderChainToken,
              adChainToken: rc.orderParams.adChainToken,
              amount: rc.orderParams.amount,
              bridger: rc.orderParams.bridger,
              orderRecipient: rc.orderParams.orderRecipient,
              adChainId: rc.orderParams.adChainId,
              adManager: rc.orderParams.adManager,
              adId: rc.orderParams.adId,
              adCreator: rc.orderParams.adCreator,
              adRecipient: rc.orderParams.adRecipient,
              salt: rc.orderParams.salt,
              orderDecimals: rc.orderParams.orderDecimals,
              adDecimals: rc.orderParams.adDecimals,
            },
            orderPortalHex: rc.contractAddress,
          },
        );
        await confirmTradeTx({
          txHash,
          signature: rc.signature,
          tradeId: response.tradeId,
        });
        return response;
      }

      const token = await getSingleToken(data.orderTokenId);

      if (token.kind === "ERC20") {
        const orderTokenAddr = hex32ToAddress20(rc.orderParams.orderChainToken);
        const approveHash = await writeContractAsync({
          address: orderTokenAddr,
          abi: ERC20_ABI,
          chainId: Number(token.chain.chainId),
          functionName: "approve",
          args: [rc.contractAddress, BigInt(rc.orderParams.amount)],
        });

        const approveReceipt = await waitForTransactionReceipt(config, {
          hash: approveHash,
        });

        if (approveReceipt.status === "success") {
          const txHash = await writeContractAsync({
            address: rc.contractAddress,
            chainId: Number(rc.chainId),
            abi: ORDER_PORTAL_ABI,
            functionName: "createOrder",
            args: [
              rc.signature,
              rc.authToken,
              BigInt(rc.timeToExpire),
              {
                orderChainToken: rc.orderParams.orderChainToken,
                adChainToken: rc.orderParams.adChainToken,
                amount: BigInt(rc.orderParams.amount),
                bridger: rc.orderParams.bridger,
                orderRecipient: rc.orderParams.orderRecipient,
                adChainId: BigInt(rc.orderParams.adChainId),
                adManager: rc.orderParams.adManager,
                adId: rc.orderParams.adId,
                adCreator: rc.orderParams.adCreator,
                adRecipient: rc.orderParams.adRecipient,
                salt: BigInt(rc.orderParams.salt),
                orderDecimals: rc.orderParams.orderDecimals,
                adDecimals: rc.orderParams.adDecimals,
              },
            ],
          });

          const receipt = await waitForTransactionReceipt(config, {
            hash: txHash,
          });
          if (receipt.status === "success") {
            await confirmTradeTx({
              txHash: receipt.transactionHash,
              signature: rc.signature,
              tradeId: response.tradeId,
            });
          }

          if (receipt.status !== "success") {
            throw Error("Transaction failed, Retry");
          }
        }

        if (approveReceipt.status !== "success") {
          throw Error("Transaction failed, Retry");
        }
      } else if (token.kind === "NATIVE") {
        const amount = formatUnits(BigInt(data.payload.amount), token.decimals);
        const txHash = await writeContractAsync({
          address: rc.contractAddress,
          chainId: Number(rc.chainId),
          abi: ORDER_PORTAL_ABI,
          functionName: "createOrder",
          args: [
            rc.signature,
            rc.authToken,
            BigInt(rc.timeToExpire),
            {
              orderChainToken: rc.orderParams.orderChainToken,
              adChainToken: rc.orderParams.adChainToken,
              amount: BigInt(rc.orderParams.amount),
              bridger: rc.orderParams.bridger,
              orderRecipient: rc.orderParams.orderRecipient,
              adChainId: BigInt(rc.orderParams.adChainId),
              adManager: rc.orderParams.adManager,
              adId: rc.orderParams.adId,
              adCreator: rc.orderParams.adCreator,
              adRecipient: rc.orderParams.adRecipient,
              salt: BigInt(rc.orderParams.salt),
              orderDecimals: rc.orderParams.orderDecimals,
              adDecimals: rc.orderParams.adDecimals,
            },
          ],
          value: parseEther(amount),
        });

        const receipt = await waitForTransactionReceipt(config, {
          hash: txHash,
        });
        if (receipt.status === "success") {
          await confirmTradeTx({
            txHash: receipt.transactionHash,
            signature: rc.signature,
            tradeId: response.tradeId,
          });
        }

        if (receipt.status !== "success") {
          throw Error("Transaction failed, Retry");
        }
      }

      return response;
    },

    onSuccess: () => {
      toast.success("Trade creation was successful");
    },
    onError: function (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to open trade",
      );
    },
  });
};

export const useLockFunds = () => {
  const { writeContractAsync } = useWriteContract();
  const { buildCtx: buildStellarCtx } = useStellarAdapter();
  return useMutation({
    mutationKey: ["lock-fund"],
    mutationFn: async (id: string) => {
      const response = await lockFunds(id);

      if (response.chainKind === "STELLAR") {
        const txHash = await lockForOrderSoroban(
          buildStellarCtx(),
          {
            signatureHex: response.signature,
            signerPublicKeyHex: response.signerPublicKey!,
            authTokenHex: response.authToken,
            timeToExpire: response.timeToExpire,
          },
          {
            orderParams: {
              orderChainToken: response.orderParams.orderChainToken,
              adChainToken: response.orderParams.adChainToken,
              amount: response.orderParams.amount,
              bridger: response.orderParams.bridger,
              orderChainId: response.orderParams.orderChainId,
              srcOrderPortal: response.orderParams.srcOrderPortal,
              orderRecipient: response.orderParams.orderRecipient,
              adId: response.orderParams.adId,
              adCreator: response.orderParams.adCreator,
              adRecipient: response.orderParams.adRecipient,
              salt: response.orderParams.salt,
              orderDecimals: response.orderParams.orderDecimals,
              adDecimals: response.orderParams.adDecimals,
            },
            adManagerHex: response.contractAddress,
          },
        );
        await confirmTradeTx({
          txHash,
          signature: response.signature,
          tradeId: id,
        });
        return response;
      }

      const txHash = await writeContractAsync({
        address: response.contractAddress,
        chainId: Number(response.chainId),
        abi: AD_MANAGER_ABI,
        functionName: "lockForOrder",
        args: [
          response.signature,
          response.authToken,
          BigInt(response.timeToExpire),
          {
            orderChainToken: response.orderParams.orderChainToken,
            adChainToken: response.orderParams.adChainToken,
            amount: BigInt(response.orderParams.amount),
            bridger: response.orderParams.bridger,
            orderChainId: BigInt(response.orderParams.orderChainId),
            srcOrderPortal: response.orderParams.srcOrderPortal,
            orderRecipient: response.orderParams.orderRecipient,
            adId: response.orderParams.adId,
            adCreator: response.orderParams.adCreator,
            adRecipient: response.orderParams.adRecipient,
            salt: BigInt(response.orderParams.salt),
            orderDecimals: response.orderParams.orderDecimals,
            adDecimals: response.orderParams.adDecimals,
          },
        ],
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });
      if (receipt.status === "success") {
        await confirmTradeTx({
          txHash: receipt.transactionHash,
          signature: response.signature,
          tradeId: id,
        });
      }

      if (receipt.status !== "success") {
        throw Error("Transaction failed, Retry");
      }

      return response;
    },

    onSuccess: () => {
      toast.success("Funds lock was successful");
    },
    onError: function (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to lock funds",
      );
    },
  });
};

export type UnlockStage = "signing" | "proving" | "submitting" | "confirming";

export const useUnLockFunds = (opts?: {
  onStage?: (stage: UnlockStage | null) => void;
}) => {
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { buildCtx: buildStellarCtx } = useStellarAdapter();
  const { signMessage: signStellarMessage } = useStellarWallet();
  const emit = (s: UnlockStage | null) => opts?.onStage?.(s);
  return useMutation({
    mutationKey: ["unlock-fund"],
    mutationFn: async (id: string) => {
      emit("signing");
      const params = await getTradeParams(id);

      // Unlock signing depends on the chain the caller is unlocking on — not
      // the caller's origin wallet. adCreator unlocks on the order chain;
      // bridger unlocks on the ad chain. Backend tells us which.
      let signature: string;
      if (params.unlockChainKind === "STELLAR") {
        // Stellar wallets (Freighter etc.) sign the raw UTF-8 bytes of the
        // message via ed25519. There's no EIP-712 equivalent UI, so we send
        // a pretty-printed JSON of the order fields — the wallet shows it to
        // the user verbatim, and the backend rebuilds the same string to
        // verify. Keep in sync with
        // apps/backend-relayer/src/providers/stellar/utils/unlock-message.ts.
        signature = await signStellarMessage(buildStellarUnlockMessage(params));
      } else {
        // Cross-chain address fields are bytes32 on-chain so the typeHash
        // stays chain-agnostic. Values arrive already 32-byte hex-padded.
        signature = await signTypedDataAsync({
          types: {
            Order: [
              { name: "orderChainToken", type: "bytes32" },
              { name: "adChainToken", type: "bytes32" },
              { name: "amount", type: "uint256" },
              { name: "bridger", type: "bytes32" },
              { name: "orderChainId", type: "uint256" },
              { name: "orderPortal", type: "bytes32" },
              { name: "orderRecipient", type: "bytes32" },
              { name: "adChainId", type: "uint256" },
              { name: "adManager", type: "bytes32" },
              { name: "adId", type: "string" },
              { name: "adCreator", type: "bytes32" },
              { name: "adRecipient", type: "bytes32" },
              { name: "salt", type: "uint256" },
              { name: "orderDecimals", type: "uint8" },
              { name: "adDecimals", type: "uint8" },
            ],
          },
          primaryType: "Order",
          message: {
            orderChainToken: params.orderChainToken,
            adChainToken: params.adChainToken,
            amount: BigInt(params.amount),
            bridger: params.bridger,
            orderChainId: BigInt(params.orderChainId),
            orderPortal: params.orderPortal,
            orderRecipient: params.orderRecipient,
            adChainId: BigInt(params.adChainId),
            adManager: params.adManager,
            adId: params.adId,
            adCreator: params.adCreator,
            adRecipient: params.adRecipient,
            salt: BigInt(params.salt),
            orderDecimals: params.orderDecimals,
            adDecimals: params.adDecimals,
          },
          domain: {
            name: "Proofbridge",
            version: "1",
          },
        });
      }
      emit("proving");
      const response = await unlockFunds({ id, signature });
      emit("submitting");

      // Role determines which contract ABI we hit. Backend ships
      // OrderPortal-shape params (adManager/adChainId) when the caller is the
      // ad creator unlocking on the order chain, and AdManager-shape
      // (srcOrderPortal/orderChainId) for the bridger unlocking on the ad
      // chain. Discriminate on the key — much more robust than comparing
      // addresses across chain kinds.
      const isAdCreator = "adManager" in response.orderParams;

      if (response.chainKind === "STELLAR") {
        // Relayer still emits the proof payload as hex strings; actions layer
        // converts buffer→ScVal bytes. Proof is already 0x-prefixed hex.
        const proofBuffer = Buffer.from(
          response.proof.replace(/^0x/, ""),
          "hex",
        );
        const txHash = isAdCreator
          ? await unlockOrderPortalSoroban(
              buildStellarCtx(),
              {
                signatureHex: response.signature,
                signerPublicKeyHex: response.signerPublicKey!,
                authTokenHex: response.authToken,
                timeToExpire: response.timeToExpire,
              },
              {
                orderParams: response.orderParams as IOrderPortalOrderParams,
                nullifierHashHex: response.nullifierHash,
                targetRootHex: response.targetRoot,
                proof: proofBuffer,
                orderPortalHex: response.contractAddress,
              },
            )
          : await unlockSoroban(
              buildStellarCtx(),
              {
                signatureHex: response.signature,
                signerPublicKeyHex: response.signerPublicKey!,
                authTokenHex: response.authToken,
                timeToExpire: response.timeToExpire,
              },
              {
                orderParams: response.orderParams as IAdManagerOrderParams,
                nullifierHashHex: response.nullifierHash,
                targetRootHex: response.targetRoot,
                proof: proofBuffer,
                adManagerHex: response.contractAddress,
              },
            );
        emit("confirming");
        await confirmUnlockFunds({
          txHash,
          id,
        });
        return response;
      }

      // adCreator unlocks on the order chain (OrderPortal ABI; adChainId +
      // adManager). Bridger unlocks on the ad chain (AdManager ABI;
      // orderChainId + srcOrderPortal). Split the wagmi call per branch so the
      // ABI narrows the args tuple correctly.
      const txHash = isAdCreator
        ? await writeContractAsync({
            address: response.contractAddress,
            chainId: Number(response.chainId),
            abi: ORDER_PORTAL_ABI,
            functionName: "unlock",
            args: [
              response.signature,
              response.authToken,
              BigInt(response.timeToExpire),
              (() => {
                const p = response.orderParams as IOrderPortalOrderParams;
                return {
                  ...p,
                  amount: BigInt(p.amount),
                  adChainId: BigInt(p.adChainId),
                  salt: BigInt(p.salt),
                };
              })(),
              response.nullifierHash,
              response.targetRoot,
              response.proof,
            ],
          })
        : await writeContractAsync({
            address: response.contractAddress,
            chainId: Number(response.chainId),
            abi: AD_MANAGER_ABI,
            functionName: "unlock",
            args: [
              response.signature,
              response.authToken,
              BigInt(response.timeToExpire),
              (() => {
                const p = response.orderParams as IAdManagerOrderParams;
                return {
                  ...p,
                  amount: BigInt(p.amount),
                  orderChainId: BigInt(p.orderChainId),
                  salt: BigInt(p.salt),
                };
              })(),
              response.nullifierHash,
              response.targetRoot,
              response.proof,
            ],
          });

      emit("confirming");
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });
      if (receipt.status === "success") {
        await confirmUnlockFunds({
          txHash: receipt.transactionHash,
          id,
        });
      }

      if (receipt.status !== "success") {
        throw Error("Transaction failed, Retry");
      }

      return response;
    },

    onSuccess: () => {
      toast.success("Funds released successfully");
      emit(null);
    },
    onError: function (error: any) {
      emit(null);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to release funds",
      );
    },
  });
};

export const useGetAllTrades = (params: IGetTradesParams) => {
  return useQuery({
    queryKey: ["trades", params],
    queryFn: () => getAllTrades(params),
  });
};
