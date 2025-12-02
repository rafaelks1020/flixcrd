import { use } from "react";

import WatchClient from "./WatchClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function WatchPage({ params }: PageProps) {
  const { id } = use(params);

  return <WatchClient titleId={id} />;
}
