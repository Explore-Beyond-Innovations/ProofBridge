import { urls } from "@/utils/urls"
import { api } from "./api.instance"
import {
  IAd,
  ICloseAdRequest,
  ICloseAdResponse,
  IConfirmAdTxRequest,
  ICreateAdRequest,
  ICreateAdResponse,
  IFundAdResponse,
  IGetAdsParams,
  ITopUpAdRequest,
  IUpdateAdRequest,
  IUpdateAdResponse,
  IWithdrawFromAdRequest,
  IWithdrawFromAdResponse,
} from "@/types/ads"
const ads_route = (path = "") => {
  return `${urls.API_URL}/v1/ads${path}`
}

export const createAd = async (data: ICreateAdRequest) => {
  const response = await api.post(ads_route("/create"), data)
  return response.data as ICreateAdResponse
}

export const fundAd = async (data: ITopUpAdRequest) => {
  const response = await api.post(ads_route(`/${data.adId}/fund`), {
    poolAmountTopUp: data.poolAmountTopUp,
  })
  return response.data as IFundAdResponse
}

export const withdrawFromAd = async (data: IWithdrawFromAdRequest) => {
  const response = await api.post(ads_route(`/${data.adId}/withdraw`), {
    poolAmountWithdraw: data.poolAmountWithdraw,
    to: data.to,
  })
  return response.data as IWithdrawFromAdResponse
}

export const closeAd = async (data: ICloseAdRequest) => {
  const response = await api.post(ads_route(`/${data.adId}/close`), {
    to: data.to,
  })
  return response.data as ICloseAdResponse
}

export const updatedAd = async (data: IUpdateAdRequest) => {
  const { adId, ...rest } = data
  const response = await api.patch(ads_route(`/${adId}/update`), {
    ...rest,
  })
  return response.data as IUpdateAdResponse
}

export const confirmAdTx = async (data: IConfirmAdTxRequest) => {
  const { adId, ...rest } = data
  const response = await api.post(ads_route(`/${adId}/confirm`), { ...rest })
  return response.data as ICreateAdResponse
}

export const getAllAds = async (params: IGetAdsParams) => {
  const response = await api.get(ads_route(), { params })
  return response.data as {
    data: IAd[]
    nextCursor: string
  }
}

export const getSingleAd = async (id: string) => {
  const response = await api.get(ads_route(`/${id}`))
  return response.data as IAd
}
