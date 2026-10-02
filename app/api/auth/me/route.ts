import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = readSession(token);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user?.isActive) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
