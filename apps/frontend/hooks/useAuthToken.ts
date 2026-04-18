"use client";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";

const AUTH_POLL_MS = 2000;

export const useAuthToken = (): string | undefined => {
  const [token, setToken] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : Cookies.get("auth_token"),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      const current = Cookies.get("auth_token");
      setToken((prev) => (prev === current ? prev : current));
    }, AUTH_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  return token;
};
