"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import Cookies from "js-cookie";
import { toast } from "sonner";
import {
  requestChallenge,
  submitLinkWallet,
  submitLogin,
} from "@/services/auth.service";
import { urls } from "@/utils/urls";
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Drives SIWE authentication. When no JWT is present this performs a fresh
 * login (creating or resolving the user behind this wallet). When a JWT is
 * already in cookies, the same signed message is instead submitted to the
 * link endpoint so the wallet attaches to the existing user.
 */
export const useEvmLogin = () => {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationKey: ["evm-siwe-login"],
    mutationFn: async () => {
      if (!address) throw new Error("EVM wallet not connected");
      if (!chainId) throw new Error("No chain selected");

      const challenge = await requestChallenge("EVM", address);
      if (challenge.chainKind !== "EVM") {
        throw new Error("Unexpected challenge kind from backend");
      }

      const message = new SiweMessage({
        domain: urls.SIGN_DOMAIN,
        address,
        statement: "Sign in with Ethereum to ProofBridge.",
        uri: urls.SIGN_URI,
        version: "1",
        chainId,
        nonce: challenge.nonce,
      }).prepareMessage();

      const signature = await signMessageAsync({ message });

      const hasToken = Boolean(Cookies.get("auth_token"));
      const hasLinkedEvm = (currentUser?.wallets ?? []).some(
        (w) => w.chainKind === "EVM",
      );

      if (hasToken && !hasLinkedEvm) {
        await submitLinkWallet({ chainKind: "EVM", message, signature });
        await queryClient.invalidateQueries({
          queryKey: CURRENT_USER_QUERY_KEY,
        });
        return { mode: "link" as const };
      }

      const data = await submitLogin({ chainKind: "EVM", message, signature });
      Cookies.set("auth_token", data.tokens.access);
      Cookies.set("refresh_token", data.tokens.refresh);
      window.location.reload();
      return { mode: "login" as const, data };
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Ethereum sign-in failed",
      );
    },
  });
};
