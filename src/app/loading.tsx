export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300" style={{ borderTopColor: "var(--accent)" }} />
    </main>
  );
}
