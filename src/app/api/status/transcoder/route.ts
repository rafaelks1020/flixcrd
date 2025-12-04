import { NextResponse } from "next/server";

const TRANSCODER_URL = process.env.TRANSCODER_BASE_URL || "http://135.148.12.209:8001";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${TRANSCODER_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        status: data.status || "ok",
        url: TRANSCODER_URL,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}`,
          url: TRANSCODER_URL,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.name === "AbortError" ? "Timeout (5s)" : error.message || "Offline",
        url: TRANSCODER_URL,
      },
      { status: 500 }
    );
  }
}
