import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = body?.username?.trim().toLowerCase();
  const password = body?.password;

  if (!username || !password) return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });

  let user;
  try {
    user = await prisma.user.findUnique({ where: { username } });
  } catch (error) {
    console.error("Login database request failed:", error);
    return NextResponse.json({ error: "Database belum siap. Pastikan migrasi dan seed sudah dijalankan di Railway." }, { status: 503 });
  }
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
