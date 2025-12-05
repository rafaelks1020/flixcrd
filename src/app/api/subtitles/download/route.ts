import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Download de legenda do OpenSubtitles
 * POST /api/subtitles/download
 * Body: { fileId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "fileId é obrigatório" }, { status: 400 });
    }

    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenSubtitles API Key não configurada" },
        { status: 500 }
      );
    }

    // Requisitar link de download
    const response = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "FlixCRD v1.0",
      },
      body: JSON.stringify({
        file_id: fileId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenSubtitles download error:", errorText);
      return NextResponse.json(
        { error: "Erro ao obter link de download", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      downloadUrl: data.link,
      fileName: data.file_name,
      requests: data.requests,
      remaining: data.remaining,
    });
  } catch (error: any) {
    console.error("Erro ao fazer download de legenda:", error);
    return NextResponse.json(
      { error: "Erro ao fazer download", details: error.message },
      { status: 500 }
    );
  }
}
