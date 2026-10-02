import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxImageSize = 5 * 1024 * 1024;
const bundledProductImages: Record<string, string> = {
  "nasi goreng spesial": "/menu/nasi%20goreng%20spesial.jpg",
  "ayam geprek sambal ijo": "/menu/Ayam%20Geprek%20with%20Sambal%20Ijo.png",
  "mie goreng jawa": "/menu/Mie%20goreng%20jawa.jpg",
  "es kopi gula aren": "/menu/Es%20kopi%20gula%20aren.jpg",
  "teh tarik dingin": "/menu/teh%20tarik%20dingin.jpg",
  "pisang goreng keju": "/menu/pisang%20goreng%20keju.jpg",
};

async function uploadProductImage(image: File) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Penyimpanan foto belum dikonfigurasi. Atur variabel Cloudinary di Vercel.");

  const extension = allowedImageTypes.get(image.type);
  if (!extension) throw new Error("Format foto harus JPG, PNG, atau WebP.");
  if (image.size > maxImageSize) throw new Error("Ukuran foto maksimal 5 MB.");

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const validImage = extension === "jpg"
    ? imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
    : extension === "png"
      ? imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : imageBuffer.toString("ascii", 0, 4) === "RIFF" && imageBuffer.toString("ascii", 8, 12) === "WEBP";
  if (!validImage) throw new Error("File yang dipilih bukan gambar yang valid.");

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "kasir-next/products";
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  const uploadData = new FormData();
  uploadData.set("file", new Blob([imageBuffer], { type: image.type }), image.name);
  uploadData.set("api_key", apiKey);
  uploadData.set("timestamp", String(timestamp));
  uploadData.set("folder", folder);
  uploadData.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body: uploadData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.secure_url !== "string") {
    throw new Error("Foto gagal diunggah ke Cloudinary. Periksa konfigurasi Cloudinary.");
  }
  return result.secure_url as string;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json(products.map((product) => ({
    ...product,
    imageUrl: product.imageUrl ?? bundledProductImages[product.name.toLowerCase()] ?? null,
  })));
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
  let imageUrl: string;
  try {
    imageUrl = await uploadProductImage(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Foto menu gagal diunggah.";
    const status = message.startsWith("Penyimpanan foto") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  const product = await prisma.product.create({ data: { name, category, price, stock, imageUrl } });
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
  if (!id) return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 });
  const formData = await request.formData();
  const image = formData.get("image");
  let imageUrl: string | undefined;
  if (image instanceof File && image.size > 0) {
    try {
      imageUrl = await uploadProductImage(image);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Foto menu gagal diunggah.";
      const status = message.startsWith("Penyimpanan foto") ? 503 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
  const name = String(formData.get("name") ?? "").trim();
  const price = formData.has("price") ? Number(formData.get("price")) : undefined;
  const stock = formData.has("stock") ? Number(formData.get("stock")) : undefined;
  const product = await prisma.product.update({ where: { id }, data: { name: name || undefined, price, stock, imageUrl } });
  return NextResponse.json(product);
}
