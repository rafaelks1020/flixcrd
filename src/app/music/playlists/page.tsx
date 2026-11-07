import { requireMusicPage } from "@/lib/music/page-access";
import { PlaylistsClient } from "./PlaylistsClient";

export const metadata = { title: "Playlists" };

export default async function PlaylistsPage() {
  await requireMusicPage("/music/playlists");
  return <PlaylistsClient />;
}
