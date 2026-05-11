# Compliance, AML/KYT, and Mainnet Readiness

ProofBridge is still in technical validation, but we are treating compliance as a mainnet-readiness requirement, not an afterthought. Our approach is permissionless core, compliant perimeter: the base protocol remains non-custodial and open, while the parts we operate — the official frontend, SDK, hosted services, screening flows, monitoring systems, and Maker/liquidity-provider onboarding — receive clear safeguards before mainnet.

ProofBridge is structurally different from privacy-mixer systems. The ZK proof is used to verify that a valid source-chain action happened before settlement; it is not used to hide transaction flows or break traceability. Order hashes, recipients, amounts, and settlement activity remain visible on-chain, which makes monitoring and forensic review possible.

Our compliance plan is organized around four practical workstreams:

---

## 1. Frontend access controls

Although the contracts are public infrastructure, the official ProofBridge frontend, SDK, and hosted services are operated by the team. That is where access controls belong.

Before mainnet, we plan to implement and counsel-review:

* Terms of Service excluding sanctioned persons and restricted jurisdictions.
* Acceptable Use Policy prohibiting illegal activity through the official interface.
* Geofencing at the CDN/application layer for sanctioned or restricted regions.
* Wallet-level UI blocks for sanctioned or clearly high-risk addresses.
* A clear statement that the frontend is an interface to non-custodial software, not a custodial exchange.

The protocol remains permissionless, but the official interface should not knowingly serve sanctioned or clearly high-risk users.

---

## 2. Sanctions screening and KYT / wallet-risk checks

Before a bridge order is created or accepted through the official frontend, ProofBridge will screen both source and destination wallets through a sanctions and wallet-risk provider.

This KYT layer will check for:

* Sanctions exposure, including OFAC, EU, UK, and UN lists.
* Wallet-risk indicators such as exposure to mixers, hacked-funds clusters, ransomware addresses, darknet markets, and known illicit actors.
* Risk scores above defined thresholds, resulting in allow, flag, or block decisions at the interface level.
* Decision logging, so blocks/flags can be reviewed and evidenced.
* A false-positive appeal path.

We are evaluating providers such as Range, TRM Labs, Chainalysis, and Elliptic. The final provider, thresholds, and response policy will be selected with external compliance support before mainnet.

---

## 3. Suspicious activity monitoring

ProofBridge’s order flow is designed to be auditable. Every order is recorded on-chain with signed terms and settlement data, which gives us a strong base for retrospective monitoring.

Before mainnet, we plan to define monitoring for patterns such as:

* Structuring or repeated large transactions.
* Rapid movement across wallets.
* Unusual cross-chain routing.
* Repeated disputed or failed orders.
* Sudden Maker volume spikes or behavioral changes.
* Activity suggesting a compromised Maker account or suspicious liquidity source.

This does not mean ProofBridge becomes a bank or custodial exchange. It means we will have an internal review process for unusual activity around the frontend, app, Makers, and liquidity flows. The review process will be defined with compliance experts and may include frontend blocks, Maker delisting from the official interface, escalation to counsel, or other documented actions depending on the facts.

---

## 4. Maker and liquidity-provider expectations

Makers are central to ProofBridge because they provide liquidity, post ads, and earn fees. At small scale, a Maker may simply be an individual posting liquidity. At material scale, a Maker may begin to look more like a professional liquidity provider or regulated service provider in their own jurisdiction.

We do not plan to KYC-gate the base protocol. However, before mainnet we will define Maker/liquidity-provider expectations with legal and compliance experts.

This will include:

* A Maker Code of Conduct covering jurisdictional compliance, sanctioned-address avoidance, and responsible liquidity provision.
* Self-attestation for Makers above material TVL or monthly-volume thresholds.
* A tiered review model for larger Makers, with KYC for individual professional Makers and KYB for entity/institutional Makers where appropriate.
* Evaluation of SEP-12-style patterns and vendors such as Sumsub, Persona, or Onfido for optional credentialed Maker lanes.
* Frontend curation controls, so bad-actor Makers can be removed from the official interface while the base contracts remain open.

The final thresholds, whether KYC/KYB is required for specific Maker tiers, and how routing priority works will be defined with external legal and compliance experts before mainnet.

---

## External support and ownership

Compliance planning will be coordinated from the product and operations side, but legal opinions, jurisdiction-specific licensing analysis, sanctions interpretation, and regulated-entity questions will be handled by external counsel and compliance professionals.

During the grant period, we plan to engage:

* Crypto-specialized counsel for FinCEN/OFAC, EU/UK, and relevant market analysis.
* A wallet-risk/KYT provider for sanctions and transaction-risk screening.
* A fractional compliance advisor or compliance officer before mainnet.
* Counsel review for ToS, Acceptable Use Policy, Maker Code of Conduct, and Maker threshold design.
