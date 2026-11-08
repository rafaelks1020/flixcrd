import { storageEnv } from "@/lib/storage-config";
import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { wasabiClient } from "@/lib/wasabi";

const bucketName = storageEnv.bucket;

export async function GET(_req: NextRequest) {
  try {
    if (!bucketName) {
      return NextResponse.json(
        {
          success: false,
          error: "WASABI_BUCKET_NAME não configurado no .env",
        },
        { status: 500 },
      );
    }

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1,
    });

    const response = await wasabiClient.send(command);

    return NextResponse.json({
      success: true,
      message: "Storage online",
      objectCount: response.KeyCount ?? 0,
    });
  } catch (error: any) {
    console.error("[Status] Erro ao testar o storage:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro desconhecido ao acessar o storage",
      },
      { status: 500 },
    );
  }
}
