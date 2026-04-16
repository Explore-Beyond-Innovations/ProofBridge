"use client";
import Cookies from "js-cookie";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useEvmLogin } from "@/hooks/useEvmAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ChainAdapter, ChainStatus } from "./types";

export const useEvmAdapter = (): ChainAdapter => {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const login = useEvmLogin();
  const { data: currentUser } = useCurrentUser();

  const hasToken = Boolean(Cookies.get("auth_token"));
  const linkedEvm = currentUser?.wallets.find((w) => w.chainKind === "EVM");
  const matchesLinked =
    !!address &&
    !!linkedEvm &&
    linkedEvm.address.toLowerCase() === address.toLowerCase();

  let status: ChainStatus = "disconnected";
  let requiresLink = false;
  if (isConnecting) {
    status = "connecting";
  } else if (isConnected && hasToken && matchesLinked) {
    status = "authenticated";
  } else if (isConnected && hasToken && !linkedEvm) {
    status = "connected";
    requiresLink = true;
  } else if (isConnected) {
    status = "connected";
  }

  return {
    id: "ethereum",
    name: "Ethereum",
    logo: "/assets/logos/eth.svg",
    chainKind: "EVM",
    address: address ?? null,
    status,
    requiresLink,
    connect: () => openConnectModal?.(),
    disconnect: () => {
      disconnect();
      if (!Cookies.get("auth_token")) return;
      const otherLinked = (currentUser?.wallets ?? []).some(
        (w) => w.chainKind !== "EVM",
      );
      if (!otherLinked) {
        Cookies.remove("auth_token");
        Cookies.remove("refresh_token");
        window.location.reload();
      }
    },
    signIn: () => login.mutate(),
    isSigningIn: login.isPending,
  };
};
