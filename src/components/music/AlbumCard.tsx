import Link from "next/link";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";

export function AlbumCard({
  href,
  title,
  subtitle,
  coverUrl,
  score,
  className,
}: {
  href: string;
  title: string;
  subtitle: string;
  coverUrl?: string | null;
  score?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group block w-[140px] shrink-0 sm:w-[180px]", className)}>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-fuchsia-500/70">
        <CoverImage src={coverUrl} alt={title} className="absolute inset-0 transition duration-500 group-hover:scale-105" />
        {typeof score === "number" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-200">
            {score.toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="truncate text-sm font-semibold text-white">{title}</div>
        <div className="truncate text-xs text-zinc-400">{subtitle}</div>
      </div>
    </Link>
  );
}
