export default function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="animate-pulse rounded-lg border border-line bg-white p-4 sm:p-5">
          <div className="h-4 w-2/3 rounded bg-paper-200" />
          <div className="mt-3 h-3 w-1/3 rounded bg-paper-100" />
          <div className="mt-4 h-8 w-28 rounded bg-campus-50" />
        </div>
      ))}
    </div>
  );
}