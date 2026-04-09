import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-6xl font-bold" style={{ color: "var(--accent)" }}>404</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Page not found</p>
      <Link href="/" className="mt-6 underline">Go home</Link>
    </main>
  );
}
