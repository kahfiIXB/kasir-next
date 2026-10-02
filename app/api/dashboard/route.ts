import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReportPeriod = "day" | "month";

const jakartaOffset = 7 * 60 * 60 * 1000;

function todayInJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function getReportRange(period: ReportPeriod, requestedDate: string) {
  const today = todayInJakarta();
  if (period === "month") {
    const candidate = /^\d{4}-\d{2}$/.test(requestedDate) ? requestedDate : today.slice(0, 7);
    const [year, month] = candidate.split("-").map(Number);
    if (month >= 1 && month <= 12) {
      return {
        date: candidate,
        start: new Date(Date.UTC(year, month - 1, 1) - jakartaOffset),
        end: new Date(Date.UTC(year, month, 1) - jakartaOffset),
      };
    }
    return getReportRange("month", today.slice(0, 7));
  }

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  const [year, month, day] = candidate.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const isValidDate = calendarDate.getUTCFullYear() === year && calendarDate.getUTCMonth() === month - 1 && calendarDate.getUTCDate() === day;
  if (!isValidDate) return getReportRange("day", today);
  const start = new Date(calendarDate.getTime() - jakartaOffset);
  return { date: candidate, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const isAdmin = user.role === "ADMIN";
  const period: ReportPeriod = isAdmin && params.get("period") === "month" ? "month" : "day";
  const requestedDate = isAdmin ? params.get("date") ?? todayInJakarta() : todayInJakarta();
  const range = getReportRange(period, requestedDate);
  const where = {
    createdAt: { gte: range.start, lt: range.end },
    status: "PAID" as const,
    ...(isAdmin ? {} : { cashierId: user.id }),
  };
  const isCsv = params.get("format") === "csv";

  const [summary, transactions, lowStock, topItems] = await Promise.all([
    prisma.transaction.aggregate({ where, _count: { _all: true }, _sum: { total: true } }),
    prisma.transaction.findMany({
      where,
      include: { cashier: { select: { name: true } }, member: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      ...(isCsv ? {} : { take: 6 }),
    }),
    isAdmin ? prisma.product.findMany({ where: { isActive: true, stock: { lte: 10 } }, select: { id: true, name: true, stock: true, category: true }, orderBy: { stock: "asc" }, take: 5 }) : Promise.resolve([]),
    prisma.transactionItem.groupBy({
      by: ["productName"],
      where: { transaction: { is: where } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const revenue = summary._sum.total ?? 0;
  const transactionCount = summary._count._all;
  if (isCsv) {
    const rows = [
      ["Periode", period === "day" ? `Harian ${range.date}` : `Bulanan ${range.date}`],
      ["Omzet", revenue],
      ["Jumlah transaksi", transactionCount],
      ["Rata-rata transaksi", transactionCount ? Math.round(revenue / transactionCount) : 0],
      [],
      ["Invoice", "Waktu", "Kasir", "Member", "Subtotal", "Diskon", "Total"],
      ...transactions.map((transaction) => [
        transaction.invoiceNumber,
        new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }).format(transaction.createdAt),
        transaction.cashier.name,
        transaction.member?.name ?? "Pelanggan umum",
        transaction.subtotal,
        transaction.discount,
        transaction.total,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rekap-${period}-${range.date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    period,
    date: range.date,
    revenue,
    transactionCount,
    averageTransaction: transactionCount ? Math.round(revenue / transactionCount) : 0,
    transactions,
    lowStock,
    topItems,
  });
}