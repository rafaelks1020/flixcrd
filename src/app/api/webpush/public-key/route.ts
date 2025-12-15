import { NextResponse } from "next/server";

import { getWebPushPublicKey } from "@/lib/webpush";

export async function GET() {
  try {
    const key = getWebPushPublicKey();
    return NextResponse.json({ publicKey: key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Web Push não configurado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
