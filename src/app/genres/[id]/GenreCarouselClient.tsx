"use client";

import Link from "next/link";
import { useRef } from "react";

interface TitleItem {
  id: string;
  name: string;
  posterUrl: string | null;
}

interface GenreCarouselClientProps {
  genreName: string;
  titles: TitleItem[];
}

export default function GenreCarouselClient({ genreName, titles }: GenreCarouselClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  function scroll(direction: "left" | "right") {
    const el = containerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 || 400;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (titles.length === 0) {
    return (
      <section className="px-4 py-6 md:px-10 md:py-10">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold md:text-3xl">{genreName}</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100"
          >
            <span>←</span>
            <span>Voltar para a home</span>
          </Link>
        </header>
        <p className="mt-6 text-sm text-zinc-500">Nenhum título encontrado para este gênero.</p>
      </section>
    );
  }

  return (
    <section className="px-4 py-6 md:px-10 md:py-10">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">{genreName}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Use as setas ou o scroll para navegar pelos títulos deste gênero.
          </p>
        </div>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 md:mt-0"
        >
          <span>←</span>
          <span>Voltar para a home</span>
        </Link>
      </header>

      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/60 px-2 py-2 text-sm text-zinc-100 hover:bg-black/80 md:inline-flex"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/60 px-2 py-2 text-sm text-zinc-100 hover:bg-black/80 md:inline-flex"
        >
          →
        </button>

        <div
          ref={containerRef}
          className="flex gap-3 overflow-x-auto pb-4 pt-2 scrollbar-hide"
        >
          {titles.map((title) => (
            <Link
              key={title.id}
              href={`/title/${title.id}`}
              className="group relative min-w-[180px] max-w-[220px] flex-shrink-0 overflow-hidden rounded-md bg-zinc-900 transition hover:-translate-y-0.5 hover:shadow-xl md:min-w-[220px]"
            >
              {title.posterUrl ? (
                <img
                  src={title.posterUrl}
                  alt={title.name}
                  className="aspect-[2/3] w-full object-cover transition group-hover:opacity-80"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-800 text-center text-xs text-zinc-400">
                  {title.name}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[11px] leading-tight">
                <div className="line-clamp-2 font-semibold text-zinc-50">{title.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
