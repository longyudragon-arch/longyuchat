import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let productionPrisma: PrismaClient | undefined;

function createPrismaClient(databaseUrl: string) {
  const prismaAdapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });

  return new PrismaClient({
    adapter: prismaAdapter,
  });
}

function getPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  if (process.env.NODE_ENV === "production") {
    productionPrisma ??= createPrismaClient(databaseUrl);
    return productionPrisma;
  }

  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient(databaseUrl);
  }

  return globalThis.prismaGlobal;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    // Prisma methods must retain the same client, including inside transactions.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
