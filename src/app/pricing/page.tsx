export default function PricingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-xl text-center">
        Start with 10 free questions per day. Upgrade to Premium for unlimited
        access, advanced analytics, and offline mode.
      </p>
      <div className="mt-10 grid md:grid-cols-2 gap-8 max-w-3xl w-full">
        <div className="rounded-xl border p-8">
          <h2 className="text-2xl font-bold">Free</h2>
          <p className="mt-2 text-3xl font-bold">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>10 questions / day</li>
            <li>Basic analytics</li>
            <li>All sections</li>
          </ul>
        </div>
        <div className="rounded-xl border-2 p-8" style={{ borderColor: "var(--accent)" }}>
          <h2 className="text-2xl font-bold">Premium</h2>
          <p className="mt-2 text-3xl font-bold">$4.99<span className="text-base font-normal">/mo</span></p>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>Unlimited questions</li>
            <li>AI-powered study paths</li>
            <li>Full adaptive mocks</li>
            <li>Offline mode</li>
            <li>Priority support</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
