import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

loadEnv({ path: ".env.admin", override: true });

const databaseUrl = new URL(process.env.DATABASE_URL ?? "mysql://root:@127.0.0.1:3306/kasir_db");
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
});
const prisma = new PrismaClient({ adapter });
const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

const products = [
  ["Nasi Goreng Spesial", "Makanan", 28000, 18, "coral"],
  ["Ayam Geprek Sambal Ijo", "Makanan", 32000, 12, "yellow"],
  ["Mie Goreng Jawa", "Makanan", 24000, 9, "blue"],
  ["Es Kopi Gula Aren", "Minuman", 18000, 24, "brown"],
  ["Teh Tarik Dingin", "Minuman", 14000, 31, "green"],
  ["Pisang Goreng Keju", "Snack", 20000, 7, "orange"],
];

try {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ruangrasa.local";
  const adminUsername = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? "Andi Nugraha";
  const [userByEmail, userByUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: adminEmail } }),
    prisma.user.findUnique({ where: { username: adminUsername } }),
  ]);
  if (userByEmail && userByUsername && userByEmail.id !== userByUsername.id) {
    throw new Error("Admin email and username belong to different users; resolve the account conflict first.");
  }

  const adminData = { name: adminName, username: adminUsername, email: adminEmail, role: "ADMIN", isActive: true };
  if (adminPassword) adminData.passwordHash = hashPassword(adminPassword);
  const existingAdmin = userByUsername ?? userByEmail;
  const admin = existingAdmin
    ? await prisma.user.update({ where: { id: existingAdmin.id }, data: adminData })
    : await prisma.user.create({ data: { ...adminData, passwordHash: hashPassword(adminPassword ?? "admin12345") } });

  for (const [name, category, price, stock, color] of products) {
    const existing = await prisma.product.findFirst({ where: { name } });
    if (!existing) await prisma.product.create({ data: { name, category, price, stock, color } });
  }

  console.log(`Seed selesai. Admin: ${admin.username}`);
} finally {
  await prisma.$disconnect();
}
