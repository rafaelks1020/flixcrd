import { DeleteBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

// Credenciais B2
const bucketName = "paelflix";
const b2KeyId = "0058ff68c68a0770000000004";
const b2Secret = "K0054uX+xPQa8rOgfzo3nuMYREswKqo";

// Cria client B2
const b2Client = new S3Client({
  region: "us-east-005",
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  forcePathStyle: true,
  credentials: {
    accessKeyId: b2KeyId,
    secretAccessKey: b2Secret,
  },
});

async function clearCORS() {
  try {
    console.log("🗑️  Deletando todas as regras CORS do bucket:", bucketName);

    const command = new DeleteBucketCorsCommand({
      Bucket: bucketName,
    });

    await b2Client.send(command);

    console.log("✅ Todas as regras CORS foram deletadas!");
    console.log("\n📝 Agora você pode configurar CORS via S3 API:");
    console.log("   npx tsx scripts/setup-b2-cors.ts");
  } catch (error: any) {
    if (error.Code === "NoSuchCORSConfiguration") {
      console.log("ℹ️  Nenhuma regra CORS encontrada (bucket já limpo)");
      console.log("\n📝 Pode configurar CORS via S3 API:");
      console.log("   npx tsx scripts/setup-b2-cors.ts");
    } else {
      console.error("❌ Erro ao deletar CORS:", error);
      console.error("\n💡 Tente deletar manualmente pela interface web:");
      console.error("   https://secure.backblaze.com/b2_buckets.htm");
    }
  }
}

clearCORS();
