const milestones = [
  "Next.js + Tailwind scaffold",
  "Prisma schema for MVP tables",
  "Model adapter boundary",
  "Sequential conversation orchestrator",
  "Vitest coverage for the core reply order path",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-16">
      <section className="max-w-3xl space-y-6">
        <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm text-[var(--muted)]">
          MVP bootstrap
        </span>
        <div className="space-y-4">
          <h1 className="text-5xl font-semibold tracking-tight">AI Chat Lab</h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
            This repository is now scaffolded around the agreed MVP: model management, single chat,
            sequential multi-model replies, and persisted history.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {milestones.map((item) => (
          <article
            key={item}
            className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(17,17,17,0.08)]"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">Included</p>
            <h2 className="mt-3 text-2xl font-medium">{item}</h2>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_20px_60px_rgba(17,17,17,0.08)]">
        <h2 className="text-2xl font-semibold">Next implementation slice</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Wire CRUD routes and page flows to Prisma, then connect the OpenAI-compatible adapter to the
          room message pipeline.
        </p>
      </section>
    </main>
  );
}

