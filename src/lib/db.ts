import { PrismaClient } from "@prisma/client";

/** Un solo cliente por proceso; en desarrollo sobrevive a la recarga en caliente. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
