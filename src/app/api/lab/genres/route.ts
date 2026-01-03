import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-mobile";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "movie";
    const mediaType = type === "movie" ? "movie" : "tv";

    try {
        const res = await fetch(`${TMDB_API}/genre/${mediaType}/list?api_key=${TMDB_KEY}&language=pt-BR`);
        if (!res.ok) throw new Error("TMDB Error");
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar gêneros" }, { status: 500 });
    }
}
