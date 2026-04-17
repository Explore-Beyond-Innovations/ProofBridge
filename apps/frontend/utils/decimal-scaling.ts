// Mirrors contracts/evm/src/libraries/DecimalScaling.sol and
// contracts/stellar/lib/proofbridge-core/src/decimal_scaling.rs. The on-chain
// libraries enforce the same rules at the contract boundary; replicating them
// off-chain lets the UI fail early with a clearer message before a tx ever
// leaves the wallet.

export const MAX_DECIMALS = 30;

export class DecimalsOutOfRangeError extends Error {
  constructor(public readonly value: number) {
    super(`decimals ${value} is out of range (max ${MAX_DECIMALS})`);
    this.name = "DecimalsOutOfRangeError";
  }
}

export class NonExactDownscaleError extends Error {
  constructor(
    public readonly amount: bigint,
    public readonly fromDec: number,
    public readonly toDec: number,
  ) {
    super(
      `amount ${amount} cannot be downscaled from ${fromDec} to ${toDec} decimals without loss`,
    );
    this.name = "NonExactDownscaleError";
  }
}

export function assertInRange(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new DecimalsOutOfRangeError(decimals);
  }
}

export function scale(amount: bigint, fromDec: number, toDec: number): bigint {
  assertInRange(fromDec);
  assertInRange(toDec);
  if (fromDec === toDec) return amount;
  const TEN = BigInt(10);
  if (toDec > fromDec) {
    const factor = TEN ** BigInt(toDec - fromDec);
    return amount * factor;
  }
  const factor = TEN ** BigInt(fromDec - toDec);
  if (amount % factor !== BigInt(0)) {
    throw new NonExactDownscaleError(amount, fromDec, toDec);
  }
  return amount / factor;
}
