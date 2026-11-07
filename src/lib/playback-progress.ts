import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function saveMovieProgress(data: {
  profileId: string;
  titleId: string;
  positionSeconds: number;
  durationSeconds: number;
}) {
  const where = { profileId: data.profileId, titleId: data.titleId, episodeId: null };
  const update = { positionSeconds: data.positionSeconds, durationSeconds: data.durationSeconds };
  const existing = await prisma.playbackProgress.findFirst({ where, select: { id: true } });

  if (existing) {
    return prisma.playbackProgress.update({ where: { id: existing.id }, data: update });
  }

  try {
    return await prisma.playbackProgress.create({ data: { ...data, episodeId: null } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

    // Outra requisição pode ter criado o filme entre a consulta e a criação.
    const concurrent = await prisma.playbackProgress.findFirst({ where, select: { id: true } });
    if (!concurrent) throw error;
    return prisma.playbackProgress.update({ where: { id: concurrent.id }, data: update });
  }
}
