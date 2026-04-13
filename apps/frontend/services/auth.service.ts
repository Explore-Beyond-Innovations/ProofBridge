import { urls } from "@/utils/urls"
import axios from "axios"

export type ChainKind = "EVM" | "STELLAR"

export interface IChallengeEvmResponse {
  chainKind: "EVM"
  address: string
  nonce: string
  domain: string
  uri: string
  expiresAt: string
}

export interface IChallengeStellarResponse {
  chainKind: "STELLAR"
  address: string
  transaction: string
  networkPassphrase: string
  expiresAt: string
}

export type IChallengeResponse =
  | IChallengeEvmResponse
  | IChallengeStellarResponse

export interface IEvmLoginInput {
  chainKind: "EVM"
  message: string
  signature: string
}

export interface IStellarLoginInput {
  chainKind: "STELLAR"
  transaction: string
}

export type ILoginInput = IEvmLoginInput | IStellarLoginInput

export interface ILoginResponse {
  user: { id: string; username: string }
  tokens: { access: string; refresh: string }
}

const auth_route = (path = "") => `${urls.API_URL}/v1/auth${path}`

export const requestChallenge = async (
  chainKind: ChainKind,
  address: string,
): Promise<IChallengeResponse> => {
  const res = await axios.post(auth_route("/challenge"), { chainKind, address })
  return res.data as IChallengeResponse
}

export const submitLogin = async (
  input: ILoginInput,
): Promise<ILoginResponse> => {
  const res = await axios.post(auth_route("/login"), input)
  return res.data as ILoginResponse
}
