"use client";
import Cookies from "js-cookie";
import { useStellarWallet } from "@/components/providers/StellarWallet";
import { useStellarLogin } from "@/hooks/useStellarAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { accountIdToHex32 } from "@/utils/stellar/address";
import type { ChainAdapter, ChainStatus } from "./types";

export const useStellarAdapter = (): ChainAdapter => {
  const { address, connect, disconnect, isConnecting } = useStellarWallet();
  const login = useStellarLogin();
  const { data: currentUser } = useCurrentUser();

  const hasToken = Boolean(Cookies.get("auth_token"));
  const linkedStellar = currentUser?.wallets.find(
    (w) => w.chainKind === "STELLAR",
  );

  let matchesLinked = false;
  if (address && linkedStellar) {
    try {
      matchesLinked =
        accountIdToHex32(address).toLowerCase() ===
        linkedStellar.address.toLowerCase();
    } catch {
      matchesLinked = false;
    }
  }

  let status: ChainStatus = "disconnected";
  let requiresLink = false;
  if (isConnecting) {
    status = "connecting";
  } else if (address && hasToken && matchesLinked) {
    status = "authenticated";
  } else if (address && hasToken && !linkedStellar) {
    // Existing session has no Stellar wallet yet — this is a first-time link.
    status = "connected";
    requiresLink = true;
  } else if (address) {
    // Either no session OR the session's linked Stellar wallet differs from
    // the one currently connected. Treat as sign-in — re-auth will swap the
    // session to the connected wallet's user (or create a new one), which
    // is safer than silently binding a mismatched wallet to the old JWT.
    status = "connected";
  }

  return {
    id: "stellar",
    name: "Stellar",
    logo: "/assets/logos/stellar-logo.svg",
    chainKind: "STELLAR",
    address,
    status,
    requiresLink,
    connect,
    disconnect: async () => {
      await disconnect();
      if (!Cookies.get("auth_token")) return;
      const otherLinked = (currentUser?.wallets ?? []).some(
        (w) => w.chainKind !== "STELLAR",
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
