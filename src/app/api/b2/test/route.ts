import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { b2Client } from "@/lib/b2";

const bucketName = process.env.B2_BUCKET;

export async function GET() {
  try {
    if (!bucketName) {
      return NextResponse.json(
        { 
          success: false, 
          error: "B2_BUCKET não configurado no .env" 
        },
        { status: 500 }
      );
    }

    // Testa listagem de objetos (precisa de credenciais válidas)
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 5, // Só pega 5 pra ser rápido
    });

    const response = await b2Client.send(command);

    return NextResponse.json({
      success: true,
      message: "✅ Conectado ao B2 com sucesso!",
      bucket: bucketName,
      objectCount: response.KeyCount || 0,
      sampleFiles: response.Contents?.slice(0, 5).map(obj => obj.Key) || [],
    });
  } catch (error: any) {
    console.error("Erro ao testar B2:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro desconhecido",
        code: error.Code || error.name,
        details: error.$metadata || null,
      },
      { status: 500 }
    );
  }
}
