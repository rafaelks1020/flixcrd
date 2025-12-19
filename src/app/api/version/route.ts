import { NextResponse } from "next/server";

import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const serverTime = new Date().toISOString();

  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.NEXT_PUBLIC_COMMIT_SHA ??
    null;

  const commitRef = process.env.VERCEL_GIT_COMMIT_REF ?? null;
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? null;
  const region = process.env.VERCEL_REGION ?? null;

  return NextResponse.json({
    name: pkg.name,
    version: pkg.version,
    commitSha,
    commitRef,
    deploymentId,
    region,
    serverTime,
  });
}
