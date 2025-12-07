import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await getSettings();

    return NextResponse.json({
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      maintenanceMode: settings.maintenanceMode,
      allowRegistration: settings.allowRegistration,
    });
  } catch (error) {
    console.error("GET /api/settings/public error", error);
    return NextResponse.json(
      { error: "Erro ao carregar configurações" },
      { status: 500 },
    );
  }
}
