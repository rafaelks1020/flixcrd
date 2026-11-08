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

    const token = process.env.TRANSCODER_TOKEN;
    const response = await fetch(`${transcoderUrl.replace(/\/+$/, "")}/health`, {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        status: data.status || "ok",
        url: null,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}`,
          url: null,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.name === "AbortError" ? "Timeout (5s)" : error.message || "Offline",
        url: null,
      },
      { status: 500 }
    );
  }
}
