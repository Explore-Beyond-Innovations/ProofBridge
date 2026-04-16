"use client"
import { useQuery } from "@tanstack/react-query"
import Cookies from "js-cookie"
import { getCurrentUser } from "@/services/user.service"

export const CURRENT_USER_QUERY_KEY = ["current-user"] as const

export const useCurrentUser = () => {
  const hasToken = Boolean(Cookies.get("auth_token"))

  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: hasToken,
    staleTime: 60_000,
    retry: false,
  })
}
