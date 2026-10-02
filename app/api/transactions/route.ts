import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TransactionInput = { productId: number; quantity: number };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const where = user.role === "ADMIN" ? {} : { cashierId: user.id };
  return NextResponse.json(await prisma.transaction.findMany({ where, include: { member: true, cashier: { select: { name: true } }, items: true }, orderBy: { createdAt: "desc" }, take: 100 }));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const items: TransactionInput[] = Array.isArray(body.items) ? body.items : [];
  const paidAmount = Number(body.paidAmount);
  const memberId = body.memberId == null || body.memberId === "" ? null : Number(body.memberId);
  if (!items.length || !Number.isFinite(paidAmount) || paidAmount < 0 || (memberId !== null && (!Number.isInteger(memberId) || memberId < 1))) {
    return NextResponse.json({ error: "Item dan pembayaran belum valid." }, { status: 400 });
  }

  const invoiceNumber = `TRX-${Date.now().toString().slice(-8)}`;
  try {
    const transaction = await prisma.$transaction(async (database) => {
      const products = await database.product.findMany({ where: { id: { in: items.map((item: { productId: number }) => Number(item.productId)) }, isActive: true } });
      const normalizedItems = items.map((item) => {
        const product = products.find((candidate) => candidate.id === Number(item.productId));
        if (!product || product.stock < Number(item.quantity)) throw new Error(`Stok ${product?.name ?? "produk"} tidak cukup.`);
        return { product, quantity: Number(item.quantity), lineTotal: product.price * Number(item.quantity) };
      });
      const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const member = memberId === null ? null : await database.member.findFirst({ where: { id: memberId, isActive: true } });
      if (memberId !== null && !member) throw new Error("Member tidak ditemukan atau sudah tidak aktif.");
      const discount = member ? Math.round(subtotal * member.discountPercent / 100) : 0;
      const total = subtotal - discount;
      if (paidAmount < total) throw new Error("Uang pembayaran kurang.");
      const created = await database.transaction.create({ data: { invoiceNumber, cashierId: user.id, memberId: member?.id ?? null, subtotal, discount, total, paidAmount, changeAmount: paidAmount - total, items: { create: normalizedItems.map((item: (typeof normalizedItems)[number]) => ({ productId: item.product.id, productName: item.product.name, price: item.product.price, quantity: item.quantity, lineTotal: item.lineTotal })) } }, include: { items: true } });
      for (const item of normalizedItems) await database.product.update({ where: { id: item.product.id }, data: { stock: { decrement: item.quantity } } });
      return created;
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transaksi gagal." }, { status: 400 });
  }
}
