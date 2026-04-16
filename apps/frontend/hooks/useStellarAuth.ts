"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { toast } from "sonner";
import {
  requestChallenge,
  submitLinkWallet,
  submitLogin,
} from "@/services/auth.service";
import { useStellarWallet } from "@/components/providers/StellarWallet";
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Drives SEP-10 authentication. When no JWT is present this performs a
 * fresh login; when a JWT is already in cookies, the signed challenge is
 * submitted to the link endpoint to attach this wallet to the current user.
 */
export const useStellarLogin = () => {
  const { address, connect, signTransaction, networkPassphrase } =
    useStellarWallet();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationKey: ["stellar-sep10-login"],
    mutationFn: async () => {
      const accountId = address ?? (await connect());
      if (!accountId) throw new Error("Stellar wallet not connected");

      const challenge = await requestChallenge("STELLAR", accountId);
      if (challenge.chainKind !== "STELLAR") {
        throw new Error("Unexpected challenge kind from backend");
      }

      const signedXdr = await signTransaction(
        challenge.transaction,
        challenge.networkPassphrase ?? networkPassphrase,
      );

      const hasToken = Boolean(Cookies.get("auth_token"));
      const hasLinkedStellar = (currentUser?.wallets ?? []).some(
        (w) => w.chainKind === "STELLAR",
      );

      if (hasToken && !hasLinkedStellar) {
        await submitLinkWallet({
          chainKind: "STELLAR",
          transaction: signedXdr,
        });
        await queryClient.invalidateQueries({
          queryKey: CURRENT_USER_QUERY_KEY,
        });
        return { mode: "link" as const };
      }

      const data = await submitLogin({
        chainKind: "STELLAR",
        transaction: signedXdr,
      });
      Cookies.set("auth_token", data.tokens.access);
      Cookies.set("refresh_token", data.tokens.refresh);
      window.location.reload();
      return { mode: "login" as const, data };
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Stellar sign-in failed",
      );
    },
  });
};
