import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-mobile";

const API_BASE = "https://superflixapi.run";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const enabled = user.role === "ADMIN" || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const apiUrl = `${API_BASE}/calendario.php`;

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
    console.error("Lab /calendario proxy error:", err);
    return NextResponse.json({ error: "Erro ao consultar API externa." }, { status: 500 });
  }
}
