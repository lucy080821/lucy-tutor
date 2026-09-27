// Lightweight, static (server-rendered, zero client JS) skeletons used by the per-route
// `loading.tsx` files. App Router prefetches these, so the user sees the next screen's shape
// immediately on navigation while the target client page's JS/data is still loading.

type Variant = "dashboard" | "practice" | "detail";

function Bar({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

function Banner() {
  return (
    <div className="bg-primary-soft">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-3">
        <Bar className="h-3 w-40" />
        <Bar className="h-8 w-2/3 max-w-md" />
        <Bar className="h-4 w-1/2 max-w-sm" />
      </div>
    </div>
  );
}

function CardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ui-card overflow-hidden">
          <Bar className="aspect-video w-full !rounded-none" />
          <div className="p-4 space-y-2">
            <Bar className="h-5 w-3/4" />
            <Bar className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RouteSkeleton({ variant = "practice" }: { variant?: Variant }) {
  if (variant === "dashboard") {
    return (
      <div className="flex-1 flex bg-background" aria-busy="true" aria-label="Đang tải">
        <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-line p-4 space-y-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Bar key={i} className="h-9 w-full" />
          ))}
        </aside>
        <div className="flex-1 min-w-0 p-4 md:p-8 space-y-6">
          <Bar className="h-8 w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="ui-card p-5 space-y-3">
                <Bar className="h-4 w-1/2" />
                <Bar className="h-7 w-2/3" />
              </div>
            ))}
          </div>
          <div className="ui-card p-6">
            <Bar className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="flex-1 bg-background px-4 md:px-8 py-8" aria-busy="true" aria-label="Đang tải">
        <div className="max-w-4xl mx-auto space-y-5">
          <Bar className="h-4 w-32" />
          <div className="ui-card p-6 md:p-8 space-y-4">
            <Bar className="h-8 w-3/4" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-5/6" />
            <Bar className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background" aria-busy="true" aria-label="Đang tải">
      <Banner />
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Bar key={i} className="h-9 w-24 !rounded-full" />
          ))}
        </div>
        <CardGrid />
      </div>
    </div>
  );
}
