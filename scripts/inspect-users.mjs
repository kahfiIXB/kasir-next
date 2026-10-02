import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "mysql://root:@127.0.0.1:3306/kasir_db");
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
});
const prisma = new PrismaClient({ adapter });

try {
  const users = await prisma.user.findMany({ select: { id: true, name: true, username: true, email: true, role: true, isActive: true } });
  console.log(JSON.stringify(users, null, 2));
} finally {
  await prisma.$disconnect();
}
