import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await prisma.member.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
  } catch (error) {
    return memberDatabaseError(error);
  }
}

function memberDatabaseError(error: unknown) {
  const messages: string[] = [];
  let currentError: unknown = error;
  let missingDatabaseObject = false;
  while (currentError && typeof currentError === "object") {
    if ("code" in currentError && (currentError.code === "P2021" || currentError.code === "P2022")) missingDatabaseObject = true;
    if ("message" in currentError && typeof currentError.message === "string") {
      messages.push(currentError.message);
      if (/unknown column|doesn't exist|does not exist|no such table/i.test(currentError.message)) missingDatabaseObject = true;
    }
    currentError = "cause" in currentError ? currentError.cause : null;
  }
  if (missingDatabaseObject) {
    return NextResponse.json({ error: "Database member belum dimigrasikan. Jalankan prisma migrate deploy." }, { status: 503 });
  }
  console.error("Member database request failed:", error);
  const message = process.env.NODE_ENV === "development" && messages.length ? messages[0] : "Gagal mengakses data member.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin yang dapat membuat member." }, { status: 403 });
  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "Nama member wajib diisi." }, { status: 400 });
  const discountPercent = user.role === "ADMIN" ? Number(body.discountPercent ?? 0) : 0;
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return NextResponse.json({ error: "Diskon member harus berupa angka bulat 0 sampai 100%." }, { status: 400 });
  }
  const code = body.code?.trim() || `MBR-${Date.now().toString().slice(-6)}`;
  try {
    const member = await prisma.member.create({ data: { code, name: body.name.trim(), phone: body.phone?.trim() || null, discountPercent } });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Kode member atau nomor telepon sudah digunakan." }, { status: 409 });
    return memberDatabaseError(error);
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "ID member tidak valid." }, { status: 400 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const discountPercent = Number(body.discountPercent);
  if (!name) return NextResponse.json({ error: "Nama member wajib diisi." }, { status: 400 });
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return NextResponse.json({ error: "Diskon member harus berupa angka bulat 0 sampai 100%." }, { status: 400 });
  }

  try {
    const member = await prisma.member.update({ where: { id }, data: { name, phone: phone || null, discountPercent } });
    return NextResponse.json(member);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2002") return NextResponse.json({ error: "Nomor telepon sudah digunakan member lain." }, { status: 409 });
    if (code === "P2025") return NextResponse.json({ error: "Member tidak ditemukan." }, { status: 404 });
    return memberDatabaseError(error);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID member tidak valid." }, { status: 400 });
  await prisma.member.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
