"use client"
import React from "react"
import type { Step } from "react-joyride"

export type FlowName =
  | "onboarding"
  | "bridge"
  | "faucet"
  | "home"
  | "orders"
  | "create-ad"

export interface OnboardingStep extends Step {
  slug: string
  route?: string
}

const paragraph = (body: React.ReactNode) => (
  <p className="text-sm leading-relaxed text-grey-200">{body}</p>
)

const connectWalletStep: OnboardingStep = {
  slug: "connect-wallet-button",
  target: '[data-tour="connect-wallet-button"]',
  title: "Welcome to ProofBridge",
  content: paragraph(
    <>
      ProofBridge connects Ethereum and Stellar with peer-to-peer trades.
      Start by opening the wallet hub to link your EVM and Stellar wallets.
    </>,
  ),
  placement: "bottom",
}

const connectHubStep: OnboardingStep = {
  slug: "connect-hub-modal",
  target: '[data-tour="connect-hub-modal"]',
  title: "Connect a wallet",
  content: paragraph(
    <>
      Connect either chain (or both), then sign in. You can always link the
      other wallet later from this same hub.
    </>,
  ),
  placement: "auto",
}

const sidebarFaucetStep: OnboardingStep = {
  slug: "sidebar-faucet",
  target: '[data-tour="sidebar-faucet"]',
  title: "Grab test tokens",
  content: paragraph(
    <>
      You're signed in. Head to the faucet to claim testnet tokens before
      your first bridge.
    </>,
  ),
  placement: "right",
}

const faucetClaimStep: OnboardingStep = {
  slug: "faucet-claim",
  target: '[data-tour="faucet-claim"]',
  title: "Claim a token",
  content: paragraph(
    <>
      Click <b>Claim</b> on the token you want. Make sure your wallet is on
      the matching chain before claiming.
    </>,
  ),
  placement: "bottom",
  route: "/faucet",
}

const bridgeSourceStep: OnboardingStep = {
  slug: "bridge-source",
  target: '[data-tour="bridge-source"]',
  title: "Pick a source chain",
  content: paragraph(<>Choose the chain you're bridging from.</>),
  placement: "bottom",
  route: "/bridge",
}

const bridgeDestStep: OnboardingStep = {
  slug: "bridge-dest",
  target: '[data-tour="bridge-dest"]',
  title: "Pick a destination",
  content: paragraph(<>Choose the chain you want to receive on.</>),
  placement: "bottom",
  route: "/bridge",
}

const bridgeTokenStep: OnboardingStep = {
  slug: "bridge-token",
  target: '[data-tour="bridge-token"]',
  title: "Pick a token",
  content: paragraph(
    <>Select the token you want to send. The ads below refresh to match.</>,
  ),
  placement: "bottom",
  route: "/bridge",
}

const bridgeAdsListStep: OnboardingStep = {
  slug: "bridge-ads-list",
  target: '[data-tour="bridge-ads-list"]',
  title: "Pick a bridge ad",
  content: paragraph(
    <>
      These are live ads from other users. Open one, enter an amount, and
      ProofBridge settles the trade after a ZK proof confirms both deposits.
    </>,
  ),
  placement: "top",
  route: "/bridge",
}

const homeStatsStep: OnboardingStep = {
  slug: "home-stats",
  target: '[data-tour="home-stats"]',
  title: "Your dashboard",
  content: paragraph(
    <>
      At a glance: active ads, total trades, completed orders, and your
      completion rate.
    </>,
  ),
  placement: "bottom",
  route: "/home",
}

const homeTabsStep: OnboardingStep = {
  slug: "home-tabs",
  target: '[data-tour="home-tabs"]',
  title: "Filter your ads",
  content: paragraph(
    <>
      Switch between all ads and ads by status — active, inactive, exhausted,
      or closed.
    </>,
  ),
  placement: "top",
  route: "/home",
}

const homeCreateAdStep: OnboardingStep = {
  slug: "sidebar-create-ad",
  target: '[data-tour="sidebar-create-ad"]',
  title: "Create an ad",
  content: paragraph(
    <>Start a new ad from here — pick a route, token, and liquidity.</>,
  ),
  placement: "right",
}

const ordersStatsStep: OnboardingStep = {
  slug: "orders-stats",
  target: '[data-tour="orders-stats"]',
  title: "Order metrics",
  content: paragraph(
    <>Totals for the active tab — switch tabs below to see each side.</>,
  ),
  placement: "bottom",
  route: "/orders",
}

const ordersTabsStep: OnboardingStep = {
  slug: "orders-tabs",
  target: '[data-tour="orders-tabs"]',
  title: "My Ads vs My Bridges",
  content: paragraph(
    <>
      <b>My Ads</b> shows orders bridgers opened against your listings.
      <b> My Bridges</b> shows bridges you sent.
    </>,
  ),
  placement: "bottom",
  route: "/orders",
}

const ordersTableStep: OnboardingStep = {
  slug: "orders-table",
  target: '[data-tour="orders-table"]',
  title: "Order actions",
  content: paragraph(
    <>
      Each row shows its status and the next action: <b>Lock</b> on an active
      order, <b>Claim</b> once both sides are locked.
    </>,
  ),
  placement: "top",
  route: "/orders",
}

const createAdBaseStep: OnboardingStep = {
  slug: "create-ad-base",
  target: '[data-tour="create-ad-base"]',
  title: "Base chain",
  content: paragraph(
    <>
      The chain you're providing liquidity on. Your funds get locked in the
      AdManager here until a bridger claims them.
    </>,
  ),
  placement: "bottom",
  route: "/ads-management/create",
}

const createAdOrderStep: OnboardingStep = {
  slug: "create-ad-order",
  target: '[data-tour="create-ad-order"]',
  title: "Destination chain",
  content: paragraph(<>The chain bridgers will send from to reach you.</>),
  placement: "bottom",
  route: "/ads-management/create",
}

const createAdTokenStep: OnboardingStep = {
  slug: "create-ad-token",
  target: '[data-tour="create-ad-token"]',
  title: "Token",
  content: paragraph(
    <>Pick the token you're providing — your wallet balance shows below.</>,
  ),
  placement: "bottom",
  route: "/ads-management/create",
}

const createAdLimitsStep: OnboardingStep = {
  slug: "create-ad-limits",
  target: '[data-tour="create-ad-limits"]',
  title: "Liquidity and limits",
  content: paragraph(
    <>
      Total liquidity for the ad, plus min and max per single order so no one
      drains the pool in a single trade.
    </>,
  ),
  placement: "top",
  route: "/ads-management/create",
}

const createAdDetailsStep: OnboardingStep = {
  slug: "create-ad-details",
  target: '[data-tour="create-ad-details"]',
  title: "Title and description",
  content: paragraph(
    <>
      Give the ad a name and terms. This is what bridgers see when they pick
      your ad.
    </>,
  ),
  placement: "top",
  route: "/ads-management/create",
}

const createAdPreviewStep: OnboardingStep = {
  slug: "create-ad-preview",
  target: '[data-tour="create-ad-preview"]',
  title: "Preview and submit",
  content: paragraph(
    <>
      Review before you sign. The next screen shows the exact on-chain steps.
    </>,
  ),
  placement: "top",
  route: "/ads-management/create",
}

export const FLOWS: Record<FlowName, OnboardingStep[]> = {
  onboarding: [
    connectWalletStep,
    connectHubStep,
    sidebarFaucetStep,
    faucetClaimStep,
    bridgeSourceStep,
    bridgeDestStep,
    bridgeTokenStep,
    bridgeAdsListStep,
  ],
  bridge: [
    bridgeSourceStep,
    bridgeDestStep,
    bridgeTokenStep,
    bridgeAdsListStep,
  ],
  faucet: [faucetClaimStep],
  home: [homeStatsStep, homeTabsStep, homeCreateAdStep],
  orders: [ordersStatsStep, ordersTabsStep, ordersTableStep],
  "create-ad": [
    createAdBaseStep,
    createAdOrderStep,
    createAdTokenStep,
    createAdLimitsStep,
    createAdDetailsStep,
    createAdPreviewStep,
  ],
}

export const FLOW_ROUTES: Record<FlowName, string | undefined> = {
  onboarding: undefined,
  bridge: "/bridge",
  faucet: "/faucet",
  home: "/home",
  orders: "/orders",
  "create-ad": "/ads-management/create",
}

export const stepIndexBySlug = (
  flow: FlowName,
  slug: string,
): number => FLOWS[flow].findIndex((s) => s.slug === slug)
