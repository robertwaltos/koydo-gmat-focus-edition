"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg px-6 py-3 font-semibold text-white"
        style={{ backgroundColor: "var(--accent)" }}
      >
        Try again
      </button>
    </main>
  );
}
