// The ONE loading screen for the whole app. Every gate that can be on screen
// while the Admin/Coach area starts up (lazy page chunks, the sign-in check,
// the first dashboard data) renders exactly this, in exactly the same place, so
// the user sees a single continuous spinner instead of several different ones.
export default function AppLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950"
    >
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-zinc-400">Loading…</p>
      </div>
    </div>
  );
}
