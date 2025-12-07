import { NextResponse } from "next/server";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function withCors(response: NextResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function corsOptionsResponse() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export function jsonWithCors(data: any, init?: { status?: number }) {
  return NextResponse.json(data, { 
    status: init?.status,
    headers: corsHeaders 
  });
}
