import { requireMusicPage } from "@/lib/music/page-access";
import { NewPlaylistClient } from "./NewPlaylistClient";

export const metadata = { title: "Nova playlist" };

export default async function NewPlaylistPage() {
  await requireMusicPage("/music/playlists/new");
  return <NewPlaylistClient />;
}
