export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <section className="text-center max-w-3xl">
        <h1 className="text-5xl font-bold tracking-tight">
          Ace the <span style={{ color: "var(--accent)" }}>GMAT</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Free GMAT Focus Edition practice questions for Quantitative, Verbal, and Data Insights with AI analytics.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/learn"
            className="rounded-lg px-6 py-3 font-semibold text-white"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Start Studying Free
          </a>
          <a
            href="/pricing"
            className="rounded-lg border px-6 py-3 font-semibold"
          >
            View Plans
          </a>
        </div>
      </section>

      <section className="mt-20 grid md:grid-cols-3 gap-8 max-w-5xl w-full">
        {[
          { title: "Quant, Verbal & DI practice", desc: "Practice with thousands of questions and detailed explanations." },
          { title: "Adaptive mock tests", desc: "Cortex-powered analytics identify weak areas and build a personalised study path." },
          { title: "AI score predictor", desc: "Realistic exam simulations with timer and scoring." }
        ].map((f) => (
          <div key={f.title} className="rounded-xl border p-6">
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 text-center text-xs text-gray-500 max-w-2xl">
        <p>
          GMAT™ is a trademark of the Graduate Management Admission Council (GMAC), which was not involved in the production of, and does not endorse, this product.
          {" "}All product names, logos, and brands are the property of their respective owners.
        </p>
      </footer>
    </main>
  );
}
