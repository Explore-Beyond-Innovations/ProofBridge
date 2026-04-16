import { urls } from "@/utils/urls";
import axios, { AxiosResponse } from "axios";
import Cookies from "js-cookie";

interface IRefreshTokenResponse {
  tokens: {
    access: string;
    refresh: string;
  };
}

const BASE_URL = urls.API_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Add this for cookies/credentials
  paramsSerializer: {
    indexes: null,
  },
});

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ensure withCredentials is set for each request
    config.withCredentials = true;

    if (process.env.NODE_ENV === "development") {
      console.log("Request URL:", (config.baseURL ?? "") + config.url);
      // console.log("Authorization Header:", config.headers.Authorization);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  async (response) => {
    return response;
  },
  async (error) => {
    if ([403].includes(error?.response?.status)) {
      error.message =
        (error?.response.data?.errors &&
          error?.response.data?.errors?.length > 0 &&
          `${error?.response.data?.errors[0]?.field_name?.replace(/_/g, " ")} -
        ${error?.response.data?.errors[0]?.message}`) ||
        error?.response.data.message ||
        error?.response.message;
      // await toast.error(error?.message);
      const refresh_token = Cookies.get("refresh_token");
      const res = await api.post<any, AxiosResponse<IRefreshTokenResponse>>(
        "/v1/auth/refresh",
        { refresh: refresh_token },
        { withCredentials: true }, // Ensure credentials for refresh token request
      );

      Cookies.set("auth_token", res.data.tokens.access);
      Cookies.set("refresh_token", res.data.tokens.refresh);
    } else if ([401].includes(error?.response?.status)) {
      error.message =
        (error?.response.data?.errors &&
          error?.response.data?.errors?.length > 0 &&
          `${error?.response.data?.errors[0]?.field_name?.replace(/_/g, " ")} -
        ${error?.response.data?.errors[0]?.message}`) ||
        error?.response.data.message ||
        error?.response.message;

      const refresh_token = Cookies.get("refresh_token");

      try {
        // Make sure refresh token request also includes credentials
        const res = await api.post<any, AxiosResponse<IRefreshTokenResponse>>(
          "/v1/auth/refresh",
          { refresh: refresh_token },
          { withCredentials: true }, // Ensure credentials for refresh token request
        );

        Cookies.set("auth_token", res.data.tokens.access);
        Cookies.set("refresh_token", res.data.tokens.refresh);
      } catch (error) {
        Cookies.remove("refresh_token");
        Cookies.remove("auth_token");
        window.location.href = "/";
      }

      console.log({ error });
    } else if ([400].includes(error?.response?.status)) {
      error.message =
        (error?.response.data?.errors &&
          error?.response.data?.errors?.length > 0 &&
          `${error?.response.data?.errors[0]?.field_name?.replace(/_/g, " ")} -
          ${error?.response.data?.errors[0]?.message}`) ||
        error?.response.data.message ||
        error?.response.message;
      // await toast.error(error?.message);
    }
    return Promise.reject(error);
  },
);
