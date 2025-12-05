export default function SkeletonCard() {
  return (
    <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 animate-pulse">
      <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="mb-8">
      {/* Title Skeleton */}
      <div className="mb-4 h-8 w-48 rounded bg-zinc-800 animate-pulse px-4 md:px-8" />
      
      {/* Cards Skeleton */}
      <div className="flex gap-2 px-4 md:gap-3 md:px-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-36 flex-shrink-0 md:w-48">
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
}
