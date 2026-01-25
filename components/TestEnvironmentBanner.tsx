'use client';

export function TestEnvironmentBanner() {
  return (
    <div className="w-full bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
      <div className="max-w-5xl mx-auto px-4 py-2 text-center">
        <span className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          This is a prototype in evolution and serves only testing and discussion purposes.
        </span>
      </div>
    </div>
  );
}
