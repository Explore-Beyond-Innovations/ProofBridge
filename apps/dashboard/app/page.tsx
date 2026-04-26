const metrics = [
  {
    label: "Transactions",
    hint: "Completed cross-chain bridges, rolling 30 days",
  },
  {
    label: "Dispute outcomes",
    hint: "Resolved disputes by class, rolling 30 days",
  },
  {
    label: "Proof-gen latency",
    hint: "p50 ZK proof generation time, rolling 30 days",
  },
];

export default function Page() {
  return (
    <main className="container">
      <div className="card">
        <img src="/logo.svg" alt="ProofBridge" className="logo" />
        <span className="badge">In Development</span>
        <h1>ProofBridge Dashboard</h1>
        <p>
          Public proof + dispute dashboard for ProofBridge — transactions,
          dispute outcomes, and proof-gen latency on rolling 30-day data.
          Currently being built; the panel below is a preview.
        </p>

        <div className="metrics">
          {metrics.map((m) => (
            <div key={m.label} className="metric">
              <div className="metric__value">—</div>
              <div className="metric__label">{m.label}</div>
              <div className="metric__hint">{m.hint}</div>
            </div>
          ))}
        </div>

        <p className="footer">
          Track the live bridge at{" "}
          <a href="https://app.pfbridge.xyz">app.pfbridge.xyz</a> · Read the
          docs at <a href="https://docs.pfbridge.xyz">docs.pfbridge.xyz</a> ·
          Follow on{" "}
          <a href="https://github.com/Explore-Beyond-Innovations/ProofBridge">
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
