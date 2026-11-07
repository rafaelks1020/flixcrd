import { NextResponse } from "next/server";

export async function GET() {
  const transcoderUrl = process.env.TRANSCODER_BASE_URL;

  if (!transcoderUrl) {
    return NextResponse.json(
      {
        success: false,
        status: "não configurado",
        error: "não configurado",
        url: null,
      },
      { status: 503 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${transcoderUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        status: data.status || "ok",
        url: transcoderUrl,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}`,
          url: transcoderUrl,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.name === "AbortError" ? "Timeout (5s)" : error.message || "Offline",
        url: transcoderUrl,
      },
      { status: 500 }
    );
  }
}
