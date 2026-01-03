import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";
import { getSuperflixUrl } from "@/lib/app-settings";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const API_BASE = await getSuperflixUrl();

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "movie";
    const type = url.searchParams.get("type") || "tmdb";
    const format = url.searchParams.get("format") || "json";
    const order = url.searchParams.get("order") || "asc";

    const params = new URLSearchParams({ category, type, format, order });
    const apiUrl = `${API_BASE}/lista?${params.toString()}`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "FlixCRD-Lab/1.0" },
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("Lab /lista proxy error:", err);
    return NextResponse.json({ error: "Erro ao consultar API externa." }, { status: 500 });
  }
}
