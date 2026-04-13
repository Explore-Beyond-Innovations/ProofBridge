import { urls } from "@/utils/urls"
import { api } from "./api.instance"
import { IChain } from "@/types/chains"

const chains_route = (path = "") => {
  return `${urls.API_URL}/v1/chains${path}`
}

export const getAllChains = async (params: {
  limit?: number
  cursor?: string
}) => {
  const response = await api.get(chains_route("/"), { params })
  return response.data as { data: IChain[]; nextCursor: string }
}

export const getSingleChain = async (id: string) => {
  const response = await api.get(chains_route(`/${id}`))
  return response.data as IChain
}
