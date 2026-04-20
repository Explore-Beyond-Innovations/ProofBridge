type Level = "info" | "warn" | "error" | "debug"

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  }
  const stream = level === "error" ? process.stderr : process.stdout
  stream.write(JSON.stringify(line) + "\n")
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
}
