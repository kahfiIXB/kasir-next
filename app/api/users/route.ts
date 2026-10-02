import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  return NextResponse.json(await prisma.user.findMany({ select: { id: true, name: true, username: true, email: true, role: true, isActive: true, createdAt: true }, orderBy: { createdAt: "desc" } }));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin yang dapat membuat akun kasir." }, { status: 403 });
  const body = await request.json();
  if (typeof body.name !== "string" || typeof body.username !== "string" || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Nama, username, email, dan password wajib diisi." }, { status: 400 });
  }
  const username = body.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return NextResponse.json({ error: "Username harus 3–32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung." }, { status: 400 });
  const email = body.email.trim().toLowerCase();
  try {
    const created = await prisma.user.create({ data: { name: body.name.trim(), username, email, passwordHash: hashPassword(body.password), role: "CASHIER" }, select: { id: true, name: true, username: true, email: true, role: true, isActive: true } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Username atau email sudah digunakan." }, { status: 409 });
    throw error;
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id || id === user.id) return NextResponse.json({ error: "Akun tidak dapat dihapus." }, { status: 400 });
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
