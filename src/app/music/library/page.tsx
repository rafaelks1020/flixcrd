import { requireMusicPage } from "@/lib/music/page-access";
import { LibraryClient } from "./LibraryClient";

export const metadata = { title: "Biblioteca" };

export default async function LibraryPage() {
  await requireMusicPage("/music/library");
  return <LibraryClient />;
}
