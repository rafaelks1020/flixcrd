import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { invalidateSettingsCache } from "@/lib/app-settings";

async function requireAdmin() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || (session.user as any).role !== "ADMIN") {
    return { isAdmin: false };
  }

  return { isAdmin: true };
}

// Carrega configurações globais
export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const settings = await getSettings();

    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/admin/settings error", error);
    return NextResponse.json(
      { error: "Erro ao carregar configurações." },
      { status: 500 },
    );
  }
}

// Atualiza configurações globais
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const {
      siteName,
      siteDescription,
      maintenanceMode,
      allowRegistration,
      maxUploadSize,
      transcoderCrf,
      deleteSourceAfterTranscode,
      labEnabled,
      // New fields
      streamingProvider,
      superflixApiUrl,
      hideAdultContent,
      adultContentPin,
      enableMovies,
      enableSeries,
      enableAnimes,
      enableDoramas,
    } = body as {
      siteName?: string;
      siteDescription?: string;
      maintenanceMode?: boolean;
      allowRegistration?: boolean;
      maxUploadSize?: number;
      transcoderCrf?: number;
      deleteSourceAfterTranscode?: boolean;
      labEnabled?: boolean;
      // New fields
      streamingProvider?: string;
      superflixApiUrl?: string;
      hideAdultContent?: boolean;
      adultContentPin?: string | null;
      enableMovies?: boolean;
      enableSeries?: boolean;
      enableAnimes?: boolean;
      enableDoramas?: boolean;
    };

    const current = await getSettings();

    const data: Record<string, unknown> = {};

    // Original fields
    if (typeof siteName === "string") data.siteName = siteName;
    if (typeof siteDescription === "string") data.siteDescription = siteDescription;
    if (typeof maintenanceMode === "boolean") data.maintenanceMode = maintenanceMode;
    if (typeof allowRegistration === "boolean") data.allowRegistration = allowRegistration;
    if (typeof maxUploadSize === "number" && !Number.isNaN(maxUploadSize)) data.maxUploadSize = maxUploadSize;
    if (typeof transcoderCrf === "number" && !Number.isNaN(transcoderCrf)) data.transcoderCrf = transcoderCrf;
    if (typeof deleteSourceAfterTranscode === "boolean") data.deleteSourceAfterTranscode = deleteSourceAfterTranscode;
    if (typeof labEnabled === "boolean") data.labEnabled = labEnabled;

    // Streaming Provider
    if (typeof streamingProvider === "string" && ["LAB", "WASABI"].includes(streamingProvider)) {
      data.streamingProvider = streamingProvider;
    }

    // SuperFlixAPI URL (also extract host)
    if (typeof superflixApiUrl === "string" && superflixApiUrl.trim()) {
      try {
        const url = new URL(superflixApiUrl.trim());
        data.superflixApiUrl = url.origin; // https://superflixapi.buzz
        data.superflixApiHost = url.host;   // superflixapi.buzz
      } catch {
        // Invalid URL, ignore
      }
    }

    // Content Filtering
    if (typeof hideAdultContent === "boolean") data.hideAdultContent = hideAdultContent;
    if (adultContentPin !== undefined) {
      data.adultContentPin = adultContentPin || null;
    }

    // Categories
    if (typeof enableMovies === "boolean") data.enableMovies = enableMovies;
    if (typeof enableSeries === "boolean") data.enableSeries = enableSeries;
    if (typeof enableAnimes === "boolean") data.enableAnimes = enableAnimes;
    if (typeof enableDoramas === "boolean") data.enableDoramas = enableDoramas;

    const updated = await prisma.settings.update({
      where: { id: current.id },
      data,
    });

    // Invalidate cache so changes take effect immediately
    invalidateSettingsCache();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/admin/settings error", error);
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 },
    );
  }
}

