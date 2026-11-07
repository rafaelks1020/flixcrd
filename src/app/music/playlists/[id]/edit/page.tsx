import { requireMusicPage } from "@/lib/music/page-access";
import { EditPlaylistClient } from "./EditPlaylistClient";

export const metadata = { title: "Editar playlist" };

export default async function EditPlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireMusicPage(`/music/playlists/${id}/edit`);
  return <EditPlaylistClient playlistId={id} userId={session.userId} />;
}
