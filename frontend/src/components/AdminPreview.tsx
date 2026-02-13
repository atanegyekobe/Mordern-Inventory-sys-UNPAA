const stats = [
  { label: "Active products", value: "128" },
  { label: "Orders today", value: "24" },
  { label: "Low stock", value: "9" },
];

export default function AdminPreview() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
            Admin suite
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Command the operation.</h2>
        </div>
        <p className="max-w-md text-sm text-black/60">
          Track inventory, approve orders, and monitor revenue in a single
          dashboard designed for busy teams.
        </p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-panel rounded-3xl p-6 text-center"
          >
            <p className="text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-black/60">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
