import { use } from "react";

import WatchClient from "./WatchClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    episodeId?: string;
  }>;
}

export default function WatchPage({ params, searchParams }: PageProps) {
  const { id } = use(params);
  const sp = searchParams ? use(searchParams) : {};
  const episodeId = sp?.episodeId;

  return <WatchClient titleId={id} episodeId={episodeId} />;
}
