import { cn } from "@/lib/utils";

export function CoverImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn("bg-gradient-to-br from-fuchsia-900/80 via-zinc-900 to-violet-950", className)}
        role="img"
        aria-label={alt}
      />
    );
  }

  return <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />;
}
