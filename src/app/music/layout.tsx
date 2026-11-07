import { MusicHeader } from "@/components/music/MusicHeader";

export const dynamic = "force-dynamic";

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <MusicHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
