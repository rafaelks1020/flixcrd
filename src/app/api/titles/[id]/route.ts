import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

import { prisma } from "@/lib/prisma";
import { wasabiClient } from "@/lib/wasabi";

const bucketName = process.env.WASABI_BUCKET_NAME;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const title = await prisma.title.findUnique({
    where: { id },
  });

  if (!title) {
    return NextResponse.json({ error: "Título não encontrado." }, { status: 404 });
  }

  return NextResponse.json(title);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const {
      tmdbId,
      type,
      slug,
      name,
      originalName,
      overview,
      tagline,
      releaseDate,
      posterUrl,
      backdropUrl,
      hlsPath,
    } = body ?? {};

    const data: any = {};

    if (tmdbId !== undefined) data.tmdbId = tmdbId;
    if (type !== undefined) data.type = type;
    if (slug !== undefined) data.slug = slug;
    if (name !== undefined) data.name = name;
    if (originalName !== undefined) data.originalName = originalName;
    if (overview !== undefined) data.overview = overview;
    if (tagline !== undefined) data.tagline = tagline;
    if (releaseDate !== undefined)
      data.releaseDate = releaseDate ? new Date(releaseDate) : null;
    if (posterUrl !== undefined) data.posterUrl = posterUrl;
    if (backdropUrl !== undefined) data.backdropUrl = backdropUrl;
    if (hlsPath !== undefined) data.hlsPath = hlsPath;

    const updated = await prisma.title.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/titles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao atualizar título." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const title = await prisma.title.findUnique({ where: { id } });

    if (!title) {
      return NextResponse.json(
        { error: "Título não encontrado." },
        { status: 404 },
      );
    }

    if (bucketName) {
      const prefixes = new Set<string>();

      if (title.hlsPath) {
        const normalized = title.hlsPath.endsWith("/")
          ? title.hlsPath
          : `${title.hlsPath}/`;
        prefixes.add(normalized);
      }

      if (title.slug) {
        prefixes.add(`titles/${title.slug}/`);
      }

      for (const prefix of prefixes) {
        try {
          const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
          });

          const listed = await wasabiClient.send(listCommand);

          if (listed.Contents && listed.Contents.length > 0) {
            const objects = listed.Contents.filter((obj) => obj.Key).map((obj) => ({
              Key: obj.Key as string,
            }));

            if (objects.length > 0) {
              const deleteCommand = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: { Objects: objects },
              });

              await wasabiClient.send(deleteCommand);
            }
          }
        } catch (err) {
          console.error(
            "Erro ao excluir objetos do Wasabi para prefixo do título",
            prefix,
            id,
            err,
          );
        }
      }
    }

    await prisma.title.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/titles/[id] error", error);
    return NextResponse.json(
      { error: "Erro ao excluir título." },
      { status: 500 },
    );
  }
}
