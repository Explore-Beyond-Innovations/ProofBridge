export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

export function assertEq<T>(actual: T, expected: T, label = "value"): void {
  if (actual !== expected) {
    throw new Error(
      `ASSERT: ${label} mismatch — expected ${JSON.stringify(
        expected,
      )}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function assertObject(
  obj: Record<string, unknown>,
  expected: Record<string, unknown>,
): void {
  for (const [k, v] of Object.entries(expected)) {
    const a = obj[k];
    if (a !== v && JSON.stringify(a) !== JSON.stringify(v)) {
      throw new Error(
        `ASSERT: field '${k}' mismatch — expected ${JSON.stringify(
          v,
        )}, got ${JSON.stringify(a)}`,
      );
    }
  }
}

export function phase(n: number | string, title: string): void {
  const bar = "=".repeat(60);
  console.log(`\n${bar}\nPhase ${n}: ${title}\n${bar}`);
}
