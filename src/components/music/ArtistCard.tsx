import Link from "next/link";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";

export function ArtistCard({
  href,
  name,
  pictureUrl,
  subtitle = "Artista",
  className,
}: {
  href: string;
  name: string;
  pictureUrl?: string | null;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group flex w-[120px] shrink-0 flex-col items-center gap-2 sm:w-[140px]", className)}>
      <div className="relative aspect-square w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-white/10 transition group-hover:ring-fuchsia-500/70">
        <CoverImage src={pictureUrl} alt={name} className="absolute inset-0 transition duration-500 group-hover:scale-105" />
      </div>
      <div className="w-full text-center">
        <div className="truncate text-sm font-semibold text-white group-hover:text-fuchsia-200">{name}</div>
        <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{subtitle}</div>
      </div>
    </Link>
  );
}
