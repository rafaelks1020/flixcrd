import { requireMusicPage } from "@/lib/music/page-access";
import { PlaylistClient } from "./PlaylistClient";

export const metadata = { title: "Playlist" };

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMusicPage(`/music/playlists/${id}`);
  return <PlaylistClient playlistId={id} />;
}
