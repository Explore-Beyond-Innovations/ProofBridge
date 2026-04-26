type ServiceStatus = "live" | "pending";

const services: {
  name: string;
  region: string;
  status: ServiceStatus;
}[] = [
  { name: "Relayer API", region: "api.pfbridge.xyz", status: "live" },
  {
    name: "EVM chain adapter",
    region: "Sepolia · OrderPortal",
    status: "pending",
  },
  {
    name: "Stellar chain adapter",
    region: "Testnet · AdManager",
    status: "pending",
  },
  {
    name: "Reconciliation worker",
    region: "Cross-chain settlement",
    status: "pending",
  },
  {
    name: "ZK proof service",
    region: "Noir circuit + bb.js",
    status: "pending",
  },
];

const cursors = [
  { chain: "Ethereum (Sepolia)", detail: "Last reconciled block" },
  { chain: "Stellar Testnet", detail: "Last reconciled ledger" },
];

const STATUS_LABEL: Record<ServiceStatus, string> = {
  live: "Live",
  pending: "Not yet reporting",
};

export default function Page() {
  return (
    <main className="container">
      <div className="card">
        <img src="/logo.svg" alt="ProofBridge" className="logo" />
        <span className="badge">In Development</span>
        <h1>ProofBridge Uptime</h1>
        <p>
          Public dashboard for the ProofBridge cross-chain reconciliation
          listener — settlement-success rate, the most recent reconciliation
          cursor per chain, and any discrepancies detected. Automated health
          probes are still being wired up; the panel below is a preview.
        </p>

        <section className="rate">
          <div className="rate__label">Settlement-success rate</div>
          <div className="rate__value">—</div>
          <div className="rate__hint">Rolling 24 hours · target ≥ 99.9%</div>
        </section>

        <section className="block">
          <h2 className="block__title">Services</h2>
          <ul className="services">
            {services.map((s) => (
              <li key={s.name} className="service">
                <span
                  className={`service__pulse service__pulse--${s.status}`}
                  aria-hidden="true"
                >
                  <span />
                </span>
                <div className="service__body">
                  <div className="service__name">{s.name}</div>
                  <div className="service__region">{s.region}</div>
                </div>
                <span className={`service__status service__status--${s.status}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="block">
          <h2 className="block__title">Reconciliation cursors</h2>
          <ul className="services">
            {cursors.map((c) => (
              <li key={c.chain} className="service">
                <span
                  className="service__pulse service__pulse--pending"
                  aria-hidden="true"
                >
                  <span />
                </span>
                <div className="service__body">
                  <div className="service__name">{c.chain}</div>
                  <div className="service__region">{c.detail}</div>
                </div>
                <span className="service__cursor">—</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="block">
          <h2 className="block__title">Discrepancy log</h2>
          <div className="empty">
            No discrepancies recorded. Detections appear here within ≤ 5
            minutes of a settlement mismatch on either chain.
          </div>
        </section>

        <p className="footer">
          Live bridge at{" "}
          <a href="https://app.pfbridge.xyz">app.pfbridge.xyz</a> · Docs at{" "}
          <a href="https://docs.pfbridge.xyz">docs.pfbridge.xyz</a> · Follow on{" "}
          <a href="https://github.com/Explore-Beyond-Innovations/ProofBridge">
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
