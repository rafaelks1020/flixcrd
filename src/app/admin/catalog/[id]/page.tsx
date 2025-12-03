import { use } from "react";

import SeasonsClient from "./SeasonsClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

export default function AdminCatalogTitlePage({ params }: PageProps) {
  const { id } = use(params);

  return <SeasonsClient titleId={id} />;
}
