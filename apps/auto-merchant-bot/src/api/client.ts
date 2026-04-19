import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios"

export interface ApiError extends Error {
  status: number
  body: unknown
}

type ReauthFn = () => Promise<void>

interface InternalConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean
  _noAuth?: boolean
}

export class ApiClient {
  private readonly http: AxiosInstance
  private access: string | null = null
  private refresh: string | null = null
  private reauthFn: ReauthFn | null = null
  private reauthInFlight: Promise<void> | null = null

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      paramsSerializer: {
        indexes: null,
      },
    })
    this.http.interceptors.request.use((cfg) => {
      const c = cfg as InternalConfig
      if (!c._noAuth && this.access) {
        c.headers.set("authorization", `Bearer ${this.access}`)
      }
      return c
    })
    this.http.interceptors.response.use(
      (res) => res,
      async (err: AxiosError) => {
        const cfg = err.config as InternalConfig | undefined
        if (
          err.response?.status === 401 &&
          cfg &&
          !cfg._isRetry &&
          !cfg._noAuth &&
          (this.refresh || this.reauthFn)
        ) {
          await this.recoverAuth()
          cfg._isRetry = true
          return this.http.request(cfg)
        }
        throw this.toApiError(err)
      },
    )
  }

  setTokens(tokens: { access: string; refresh: string }): void {
    this.access = tokens.access
    this.refresh = tokens.refresh
  }

  clearTokens(): void {
    this.access = null
    this.refresh = null
  }

  setReauth(fn: ReauthFn): void {
    this.reauthFn = fn
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    opts: {
      body?: unknown
      auth?: boolean
      query?: Record<string, unknown>
    } = {},
  ): Promise<T> {
    const cfg: AxiosRequestConfig = {
      method,
      url: path.replace(/^\//, ""),
      data: opts.body,
      params: opts.query,
    }
    if (opts.auth === false) {
      ;(cfg as InternalConfig)._noAuth = true
    }
    const res = await this.http.request<T>(cfg)
    return res.data
  }

  get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    return this.request<T>("GET", path, { query })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body })
  }

  private recoverAuth(): Promise<void> {
    if (this.reauthInFlight) return this.reauthInFlight
    this.reauthInFlight = (async () => {
      try {
        if (this.refresh) {
          try {
            const tokens = await this.doRefresh(this.refresh)
            this.setTokens(tokens)
            return
          } catch {
            this.clearTokens()
          }
        }
        if (!this.reauthFn) {
          throw new Error("session expired and no reauth handler registered")
        }
        await this.reauthFn()
      } finally {
        this.reauthInFlight = null
      }
    })()
    return this.reauthInFlight
  }

  private async doRefresh(
    refreshToken: string,
  ): Promise<{ access: string; refresh: string }> {
    const res = await this.http.request<{
      tokens: { access: string; refresh: string }
    }>({
      method: "POST",
      url: "v1/auth/refresh",
      data: { refresh: refreshToken },
      ...({ _noAuth: true, _isRetry: true } as Partial<InternalConfig>),
    })
    return res.data.tokens
  }

  private toApiError(err: AxiosError): ApiError {
    const method = err.config?.method?.toUpperCase() ?? "?"
    const url = err.config?.url ?? "?"
    if (err.response) {
      const body = err.response.data
      const msg =
        (body && typeof body === "object" && "message" in body
          ? String((body as { message: unknown }).message)
          : null) ?? err.response.statusText
      const e = new Error(
        `${method} ${url} → ${err.response.status}: ${msg}`,
      ) as ApiError
      e.status = err.response.status
      e.body = body
      return e
    }
    const cause = err.cause as { code?: string; message?: string } | undefined
    const detail =
      cause?.code && cause.message
        ? `${cause.code}: ${cause.message}`
        : (err.code ?? err.message)
    const e = new Error(
      `${method} ${url} transport error: ${detail}`,
    ) as ApiError
    e.status = 0
    e.body = null
    return e
  }
}
