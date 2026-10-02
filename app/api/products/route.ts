import { NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxImageSize = 5 * 1024 * 1024;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin yang dapat menambah produk." }, { status: 403 });
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock") ?? 0);
  const image = formData.get("image");
  if (!name || !category || !Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    return NextResponse.json({ error: "Data produk tidak lengkap atau tidak valid." }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Foto menu wajib ditambahkan." }, { status: 400 });
  }
  const extension = allowedImageTypes.get(image.type);
  if (!extension) return NextResponse.json({ error: "Format foto harus JPG, PNG, atau WebP." }, { status: 400 });
  if (image.size > maxImageSize) return NextResponse.json({ error: "Ukuran foto maksimal 5 MB." }, { status: 400 });

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const validImage = extension === "jpg"
    ? imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
    : extension === "png"
      ? imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : imageBuffer.toString("ascii", 0, 4) === "RIFF" && imageBuffer.toString("ascii", 8, 12) === "WEBP";
  if (!validImage) return NextResponse.json({ error: "File yang dipilih bukan gambar yang valid." }, { status: 400 });

  const filename = `${randomUUID()}.${extension}`;
  const uploadDirectory = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDirectory, { recursive: true });
  const imagePath = path.join(uploadDirectory, filename);
  await writeFile(imagePath, imageBuffer);
  const imageUrl = `/uploads/products/${filename}`;
  let product;
  try {
    product = await prisma.product.create({ data: { name, category, price, stock, imageUrl } });
  } catch (error) {
    await unlink(imagePath).catch(() => undefined);
    throw error;
  }
  return NextResponse.json(product, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 });
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const body = await request.json();
  if (!id) return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 });
  const product = await prisma.product.update({ where: { id }, data: { name: body.name?.trim(), price: body.price === undefined ? undefined : Number(body.price), stock: body.stock === undefined ? undefined : Number(body.stock), category: body.category, isActive: body.isActive } });
  return NextResponse.json(product);
}
