export type TxStageDef = {
  key: string;
  label: string;
  hint: string;
  showTimer?: boolean;
};

const PREPARING: TxStageDef = {
  key: "preparing",
  label: "Preparing transaction",
  hint: "Fetching contract parameters from the relayer.",
};

const APPROVING: TxStageDef = {
  key: "approving",
  label: "Approving token spend",
  hint: "One-time ERC20 approval so the contract can pull your tokens.",
};

const SIGNING: TxStageDef = {
  key: "signing",
  label: "Awaiting wallet signature",
  hint: "Approve the transaction in your wallet.",
};

const SUBMITTING: TxStageDef = {
  key: "submitting",
  label: "Submitting on-chain",
  hint: "Sending the transaction and waiting for it to confirm.",
};

const CONFIRMING: TxStageDef = {
  key: "confirming",
  label: "Finalising",
  hint: "Notifying the relayer that the on-chain tx landed.",
};

const PROVING: TxStageDef = {
  key: "proving",
  label: "Generating ZK proof",
  hint: "This is the slow one — usually 30 to 60 seconds. Keep this window open.",
  showTimer: true,
};

const TRUSTLINE: TxStageDef = {
  key: "trustline",
  label: "Checking Stellar trustline",
  hint: "One-time trustline setup for SAC assets.",
};

// Flow stage sets. ERC20 approve is conditional — include it only when the
// caller knows the flow will need it (call `withApprove()` below).
export const CREATE_AD_STAGES: TxStageDef[] = [
  PREPARING,
  SUBMITTING,
  CONFIRMING,
];

export const FUND_AD_STAGES: TxStageDef[] = [PREPARING, SUBMITTING, CONFIRMING];

export const WITHDRAW_AD_STAGES: TxStageDef[] = [
  PREPARING,
  SUBMITTING,
  CONFIRMING,
];

export const LOCK_ORDER_STAGES: TxStageDef[] = [
  PREPARING,
  SUBMITTING,
  CONFIRMING,
];

export const CREATE_ORDER_STAGES: TxStageDef[] = [
  PREPARING,
  SUBMITTING,
  CONFIRMING,
];

export const UNLOCK_ORDER_STAGES: TxStageDef[] = [
  SIGNING,
  PROVING,
  SUBMITTING,
  CONFIRMING,
];

// Insert the ERC20 approve stage between PREPARING and SUBMITTING for flows
// where the user knows at click-time they're spending an ERC20 token.
export function withApprove(stages: TxStageDef[]): TxStageDef[] {
  return stages.flatMap((s) => (s.key === "preparing" ? [s, APPROVING] : [s]));
}

// Insert the Stellar trustline-check stage in the same slot for SAC-backed
// flows. Cheap no-op when the trustline already exists.
export function withTrustline(stages: TxStageDef[]): TxStageDef[] {
  return stages.flatMap((s) => (s.key === "preparing" ? [s, TRUSTLINE] : [s]));
}
