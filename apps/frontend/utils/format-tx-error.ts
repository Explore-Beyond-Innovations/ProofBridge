export function formatTxError(error: unknown, fallback: string): string {
  const e = error as {
    shortMessage?: string;
    details?: string;
    message?: string;
    cause?: {
      shortMessage?: string;
      details?: string;
      message?: string;
      reason?: string;
    };
    response?: { data?: { message?: unknown } };
    reason?: string;
  };

  const backend =
    typeof e.response?.data?.message === "string"
      ? e.response.data.message
      : null;

  const msg =
    backend ??
    e.cause?.shortMessage ??
    e.cause?.details ??
    e.cause?.reason ??
    e.shortMessage ??
    e.details ??
    e.reason ??
    (e.message
      ? e.message
          .split("\n")
          .map((l) => l.trim())
          .find(Boolean)
      : null) ??
    fallback;

  return msg.length > 200 ? msg.slice(0, 197) + "..." : msg;
}
