import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

// Pega credenciais direto do .env (Next.js já carrega automaticamente)
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

async function setupCORS() {
  try {
    const corsConfiguration = {
      CORSRules: [
        {
          AllowedHeaders: ["*"], // Asterisco sozinho = permite todos os headers
          AllowedMethods: ["GET", "HEAD", "PUT", "POST", "DELETE"],
          AllowedOrigins: ["*"], // Permite todas as origens (mais simples)
          ExposeHeaders: ["ETag", "x-amz-request-id"],
          MaxAgeSeconds: 3600,
        },
      ],
    };

    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration,
    });

    await b2Client.send(command);

    console.log("✅ CORS configurado com sucesso no bucket:", bucketName);
    console.log("\nRegras CORS aplicadas:");
    console.log(JSON.stringify(corsConfiguration, null, 2));
    console.log("\n⏰ Aguarde ~10 minutos para as regras propagarem.");
  } catch (error) {
    console.error("❌ Erro ao configurar CORS:", error);
    process.exit(1);
  }
}

setupCORS();
