export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col" aria-live="polite" aria-busy="true">
      <div className="h-16 shrink-0" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
      </main>
    </div>
  );
}
