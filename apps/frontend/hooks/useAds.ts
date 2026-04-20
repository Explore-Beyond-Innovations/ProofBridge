import { AD_MANAGER_ABI } from "@/abis/AdManager.abi";
import { ERC20_ABI } from "@/abis/ERC20.abi";
import {
  closeAd,
  confirmAdTx,
  createAd,
  fundAd,
  getAllAds,
  getSingleAd,
  withdrawFromAd,
} from "@/services/ads.service";
import {
  ICloseAdRequest,
  IConfirmAdTxRequest,
  ICreateAdRequest,
  IGetAdsParams,
  ITopUpAdRequest,
  IWithdrawFromAdRequest,
} from "@/types/ads";
import { config } from "@/utils/wagmi-config";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatTxError } from "@/utils/format-tx-error";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { getSingleToken } from "@/services/tokens.service";
import { IToken } from "@/types/tokens";
import { formatUnits, parseEther } from "viem";
import { useStellarAdapter } from "@/lib/stellar-adapter";
import {
  closeAdSoroban,
  createAdSoroban,
  fundAdSoroban,
  withdrawFromAdSoroban,
} from "@/utils/stellar/actions";
import {
  establishTrustline,
  hasTrustline,
} from "@/utils/stellar/trustline";
import type { TrustlineCtx } from "@/utils/stellar/trustline";
import type { IAdToken } from "@/types/ads";

/**
 * Blocks Stellar SAC withdrawals/closes when the recipient pubkey has no
 * trustline to the underlying classic asset. Soroban would otherwise revert
 * the transfer mid-flight with a generic error; this surfaces it early.
 */
async function assertRecipientTrustline(
  adToken: IAdToken,
  toPublicKey: string,
): Promise<void> {
  if (adToken.chainKind !== "STELLAR") return;
  if (adToken.kind !== "SAC") return;
  if (!adToken.assetIssuer) {
    throw new Error(
      `Token ${adToken.symbol} is marked SAC but has no assetIssuer configured`,
    );
  }
  const ok = await hasTrustline(
    toPublicKey,
    adToken.symbol,
    adToken.assetIssuer,
  );
  if (!ok) {
    throw new Error(
      `Recipient ${toPublicKey.slice(0, 6)}… has no trustline for ${adToken.symbol}. Ask them to add the asset in their Stellar wallet (issuer ${adToken.assetIssuer.slice(0, 6)}…) before retrying.`,
    );
  }
}

/**
 * For SAC tokens, the signer's account must trust the underlying classic
 * asset or the SAC transfer will fail. Adds the trustline on-demand before
 * the contract call. No-op for NATIVE/SEP41 and when the trustline already
 * exists.
 */
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

export const useCreateAd = () => {
  const { writeContractAsync } = useWriteContract();
  const {
    buildCtx: buildStellarCtx,
    buildTrustlineCtx,
    address: stellarAddress,
  } = useStellarAdapter();
  return useMutation({
    mutationKey: ["create-ad"],
    mutationFn: async (data: { payload: ICreateAdRequest; token: IToken }) => {
      const response = await createAd(data.payload);
      const token = data.token;

      if (response.chainKind === "STELLAR") {
        if (!stellarAddress) throw new Error("Stellar wallet not connected");
        await ensureSacTrustline(token, buildTrustlineCtx());
        const txHash = await createAdSoroban(
          buildStellarCtx(),
          {
            signatureHex: response.signature,
            signerPublicKeyHex: response.signerPublicKey!,
            authTokenHex: response.authToken,
            timeToExpire: response.timeToExpire,
          },
          {
            creatorPublicKey: stellarAddress,
            adId: response.adId,
            adTokenHex: response.adToken,
            initialAmount: data.payload.fundAmount,
            orderChainId: response.orderChainId,
            adRecipientHex: response.adRecipient,
            adManagerHex: response.contractAddress,
          },
        );
        await confirmAdTx({
          txHash,
          signature: response.signature,
          adId: response.adId,
        });
        return response;
      }

      const performERC20Tx = async () => {
        const txHash = await writeContractAsync({
          address: response.contractAddress,
          abi: AD_MANAGER_ABI,
          chainId: Number(response.chainId),
          functionName: "createAd",
          args: [
            response.signature,
            response.authToken,
            BigInt(response.timeToExpire),
            response.adId,
            response.adToken,
            BigInt(data.payload.fundAmount),
            BigInt(response.orderChainId),
            response.adRecipient,
          ],
        });
        const receipt = await waitForTransactionReceipt(config, {
          hash: txHash,
        });

        if (receipt.status === "success") {
          await confirmAdTx({
            txHash: receipt.transactionHash,
            signature: response.signature,
            adId: response.adId,
          });
        }

        if (receipt.status === "reverted") {
          throw Error("Transaction failed, Retry");
        }
      };
      if (token.kind === "ERC20") {
        const approveHash = await writeContractAsync({
          address: token.address,
          abi: ERC20_ABI,
          chainId: Number(response.chainId),
          functionName: "approve",
          args: [response.contractAddress, BigInt(data.payload.fundAmount)],
        });
        const approveReceipt = await waitForTransactionReceipt(config, {
          hash: approveHash,
        });
        if (approveReceipt.status === "success") {
          await performERC20Tx();
        }
        if (approveReceipt.status === "reverted") {
          throw Error("Transaction not approved");
        }
      }
      if (token.kind === "NATIVE") {
        const amount = formatUnits(
          BigInt(data.payload.fundAmount),
          token.decimals
        );
        const txHash = await writeContractAsync({
          address: response.contractAddress,
          abi: AD_MANAGER_ABI,
          chainId: Number(response.chainId),
          functionName: "createAd",
          args: [
            response.signature,
            response.authToken,
            BigInt(response.timeToExpire),
            response.adId,
            response.adToken,
            BigInt(data.payload.fundAmount),
            BigInt(response.orderChainId),
            response.adRecipient,
          ],
          value: parseEther(amount),
        });
        const txReceipt = await waitForTransactionReceipt(config, {
          hash: txHash,
        });
        if (txReceipt.status === "success") {
          await confirmAdTx({
            txHash: txReceipt.transactionHash,
            signature: response.signature,
            adId: response.adId,
          });
        }
        if (txReceipt.status === "reverted") {
          throw Error("Transaction failed");
        }
      }
      return response;
    },
    onSuccess: () => {
      toast.success("Ad creation was successful");
    },
    onError: (error: unknown) => {
      toast.error(formatTxError(error, "Unable to create ad"));
    },
  });
};

export const useFundAd = () => {
  const { writeContractAsync } = useWriteContract();
  const { buildCtx: buildStellarCtx, buildTrustlineCtx } = useStellarAdapter();

  return useMutation({
    mutationKey: ["fund-ad"],
    mutationFn: async (data: ITopUpAdRequest) => {
      const response = await fundAd(data);
      const token = await getSingleToken(data.tokenId);

      if (response.chainKind === "STELLAR") {
        await ensureSacTrustline(token, buildTrustlineCtx());
        const txHash = await fundAdSoroban(
          buildStellarCtx(),
          {
            signatureHex: response.signature,
            signerPublicKeyHex: response.signerPublicKey!,
            authTokenHex: response.authToken,
            timeToExpire: response.timeToExpire,
          },
          {
            adId: response.adId,
            amount: data.amountBigInt.toString(),
            adManagerHex: response.contractAddress,
          },
        );
        await confirmAdTx({
          txHash,
          signature: response.signature,
          adId: response.adId,
        });
        return response;
      }

      if (token.kind === "ERC20") {
        const approveHash = await writeContractAsync({
          address: token.address,
          abi: ERC20_ABI,
          chainId: Number(response.chainId),
          functionName: "approve",
          args: [response.contractAddress, data.amountBigInt],
        });

        const approveReceipt = await waitForTransactionReceipt(config, {
          hash: approveHash,
        });

        if (approveReceipt.status === "success") {
          const txHash = await writeContractAsync({
            address: response.contractAddress,
            abi: AD_MANAGER_ABI,
            chainId: Number(response.chainId),
            functionName: "fundAd",
            args: [
              response.signature,
              response.authToken,
              BigInt(response.timeToExpire),
              response.adId,
              data.amountBigInt,
            ],
          });
          const receipt = await waitForTransactionReceipt(config, {
            hash: txHash,
          });

          if (receipt.status === "success") {
            await confirmAdTx({
              txHash: receipt.transactionHash,
              signature: response.signature,
              adId: response.adId,
            });
          }

          if (receipt.status === "reverted") {
            throw Error("Transaction failed, Retry");
          }
        }
        if (approveReceipt.status === "reverted") {
          throw Error("Transaction not approved");
        }
      }

      if (token.kind === "NATIVE") {
        const amount = formatUnits(
          BigInt(data.amountBigInt.toString()),
          token.decimals
        );
        const txHash = await writeContractAsync({
          address: response.contractAddress,
          abi: AD_MANAGER_ABI,
          chainId: Number(response.chainId),
          functionName: "fundAd",
          args: [
            response.signature,
            response.authToken,
            BigInt(response.timeToExpire),
            response.adId,
            data.amountBigInt,
          ],
          value: parseEther(amount),
        });
        const receipt = await waitForTransactionReceipt(config, {
          hash: txHash,
        });

        if (receipt.status === "success") {
          await confirmAdTx({
            txHash: receipt.transactionHash,
            signature: response.signature,
            adId: response.adId,
          });
        }

        if (receipt.status === "reverted") {
          throw Error("Transaction failed, Retry");
        }
      }
      return response;
    },
    onSuccess: () => {
      toast.success("Ad top up was successful");
    },
    onError: (error: unknown) => {
      toast.error(formatTxError(error, "Unable to top up ad"));
    },
  });
};

export const useWithdrawFunds = () => {
  const { writeContractAsync } = useWriteContract();
  const { buildCtx: buildStellarCtx } = useStellarAdapter();

  return useMutation({
    mutationKey: ["withdraw-ad"],
    mutationFn: async (data: IWithdrawFromAdRequest) => {
      const response = await withdrawFromAd(data);

      if (response.chainKind === "STELLAR") {
        const ad = await getSingleAd(data.adId);
        await assertRecipientTrustline(ad.adToken, data.to);
        const txHash = await withdrawFromAdSoroban(
          buildStellarCtx(),
          {
            signatureHex: response.signature,
            signerPublicKeyHex: response.signerPublicKey!,
            authTokenHex: response.authToken,
            timeToExpire: response.timeToExpire,
          },
          {
            adId: response.adId,
            amount: data.amountBigInt.toString(),
            toPublicKey: data.to,
            adManagerHex: response.contractAddress,
          },
        );
        await confirmAdTx({
          txHash,
          signature: response.signature,
          adId: response.adId,
        });
        return response;
      }

      const txHash = await writeContractAsync({
        address: response.contractAddress,
        abi: AD_MANAGER_ABI,
        chainId: Number(response.chainId),
        functionName: "withdrawFromAd",
        args: [
          response.signature,
          response.authToken,
          BigInt(response.timeToExpire),
          response.adId,
          data.amountBigInt,
          data.to as `0x${string}`,
        ],
      });
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });

      if (receipt.status === "success") {
        await confirmAdTx({
          txHash: receipt.transactionHash,
          signature: response.signature,
          adId: response.adId,
        });
      }
      return response;
    },
    onSuccess: () => {
      toast.success("Funds withdrawal was successful");
    },
    onError: (error: unknown) => {
      toast.error(formatTxError(error, "Unable to withdraw"));
    },
  });
};

export const useCloseAd = () => {
  const { writeContractAsync } = useWriteContract();
  const { buildCtx: buildStellarCtx } = useStellarAdapter();

  return useMutation({
    mutationKey: ["close-ad"],
    mutationFn: async (data: ICloseAdRequest) => {
      const response = await closeAd(data);

      if (response.chainKind === "STELLAR") {
        const ad = await getSingleAd(data.adId);
        await assertRecipientTrustline(ad.adToken, data.to);
        const txHash = await closeAdSoroban(
          buildStellarCtx(),
          {
            signatureHex: response.signature,
            signerPublicKeyHex: response.signerPublicKey!,
            authTokenHex: response.authToken,
            timeToExpire: response.timeToExpire,
          },
          {
            adId: response.adId,
            toPublicKey: data.to,
            adManagerHex: response.contractAddress,
          },
        );
        await confirmAdTx({
          txHash,
          signature: response.signature,
          adId: response.adId,
        });
        return response;
      }

      const txHash = await writeContractAsync({
        address: response.contractAddress,
        abi: AD_MANAGER_ABI,
        chainId: Number(response.chainId),
        functionName: "closeAd",
        args: [
          response.signature,
          response.authToken,
          BigInt(response.timeToExpire),
          response.adId,
          data.to as `0x${string}`,
        ],
      });
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });

      if (receipt.status === "success") {
        await confirmAdTx({
          txHash: receipt.transactionHash,
          signature: response.signature,
          adId: response.adId,
        });
      }
      return response;
    },
    onSuccess: () => {
      toast.success("Ad closed successfully");
    },
    onError: (error: unknown) => {
      toast.error(formatTxError(error, "Unable to close ad"));
    },
  });
};

export const useConfirmAdTx = () => {
  return useMutation({
    mutationKey: ["confirm-ad-tx"],
    mutationFn: (data: IConfirmAdTxRequest) => {
      return confirmAdTx(data);
    },
    onSuccess: () => {
      toast.success("Tx confirmed successful");
    },
    onError: (error: unknown) => {
      toast.error(formatTxError(error, "Unable to confirm ad"));
    },
  });
};

export const useGetAllAds = (params: IGetAdsParams) => {
  return useQuery({
    queryKey: ["get-all-ads", params],
    queryFn: () => getAllAds(params),
  });
};

export const useGetSingleAd = (id: string) => {
  return useQuery({
    queryKey: ["get-single-ad", id],
    queryFn: () => getSingleAd(id),
  });
};
