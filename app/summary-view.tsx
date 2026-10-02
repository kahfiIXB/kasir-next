"use client";

import { useEffect, useState } from "react";

type SummaryRole = "ADMIN" | "CASHIER";
type SalesSummary = {
  period: "day" | "month";
  date: string;
  revenue: number;
  transactionCount: number;
  averageTransaction: number;
  transactions: { id: number; invoiceNumber: string; total: number; createdAt: string; cashier: { name: string } }[];
  lowStock: { id: number; name: string; stock: number; category: string }[];
  topItems: { productName: string; _sum: { quantity: number | null; lineTotal: number | null } }[];
};

const formatPrice = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

function todayInJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}

export default function PeriodSummaryView({ role }: { role: SummaryRole }) {
  const isAdmin = role === "ADMIN";
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(todayInJakarta);
  const [selectedMonth, setSelectedMonth] = useState(() => todayInJakarta().slice(0, 7));
  const [stats, setStats] = useState<SalesSummary | null>(null);
  const [error, setError] = useState("");
  const dateValue = period === "day" ? selectedDate : selectedMonth;

  useEffect(() => {
    const query = new URLSearchParams({ period, date: dateValue });
    let cancelled = false;
    setStats(null);
    setError("");
    fetch(`/api/dashboard?${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Data ringkasan tidak tersedia.");
        if (!cancelled) setStats(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Gagal memuat ringkasan.");
      });
    return () => { cancelled = true; };
  }, [dateValue, period]);

  const exportQuery = new URLSearchParams({ format: "csv", period, date: dateValue });
  const reportLabel = !stats ? "Laporan penjualan" : stats.period === "month"
    ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${stats.date}-01T12:00:00+07:00`))
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(`${stats.date}T12:00:00+07:00`));

  return <div className="summary-view">
    <div className="summary-intro">
      <div><p className="eyebrow">PERFORMA TOKO · {isAdmin ? reportLabel.toUpperCase() : "HARI INI"}</p><h2>Ringkasan penjualan</h2><p>{isAdmin ? `Rekap penjualan untuk ${reportLabel}.` : "Rekap penjualanmu hari ini."}</p></div>
      <div className="summary-actions">
        {isAdmin && <div className="period-switch" role="group" aria-label="Periode laporan">
          <button type="button" className={period === "day" ? "selected" : ""} onClick={() => setPeriod("day")}>Per hari</button>
          <button type="button" className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Per bulan</button>
        </div>}
        {isAdmin && (period === "day"
          ? <input className="report-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Pilih tanggal laporan" />
          : <input className="report-date" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Pilih bulan laporan" />)}
        <a className="outline-button download-report" href={`/api/dashboard?${exportQuery}`}>↓ Unduh CSV</a>
      </div>
    </div>
    {error ? <div className="placeholder-view"><div className="placeholder-icon">!</div><h2>{error}</h2><p>Coba muat ulang setelah database siap.</p></div> : !stats ? <div className="auth-loading summary-loading">Memuat ringkasan...</div> : <>
      <div className="metric-grid">
        <div className="metric-card accent"><span>Omzet {isAdmin ? reportLabel : "hari ini"}</span><strong>{formatPrice(stats.revenue)}</strong><small>Transaksi berstatus lunas</small></div>
        <div className="metric-card"><span>Total transaksi</span><strong>{stats.transactionCount}</strong><small>Pesanan diproses pada periode ini</small></div>
        <div className="metric-card"><span>Rata-rata transaksi</span><strong>{formatPrice(stats.averageTransaction)}</strong><small>Nilai per pesanan</small></div>
      </div>
      <div className="analysis-grid">
        <section className="analysis-panel">
          <div className="analysis-heading"><div><span className="panel-kicker">AKTIVITAS</span><h3>Transaksi {isAdmin ? reportLabel : "hari ini"}</h3></div><span className="live-pill"><i className="live-dot" /> {stats.transactionCount} transaksi</span></div>
          {stats.transactions.length ? stats.transactions.map((transaction) => <div className="activity-row" key={transaction.id}><span className="activity-icon">↗</span><span><strong>{transaction.invoiceNumber}</strong><small>{transaction.cashier.name} · {new Date(transaction.createdAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}</small></span><b>{formatPrice(transaction.total)}</b></div>) : <p className="empty-analysis">Belum ada transaksi pada periode ini.</p>}
        </section>
        <section className="analysis-panel">
          <div className="analysis-heading"><div><span className="panel-kicker">MENU TERLARIS</span><h3>Produk favorit</h3></div></div>
          {stats.topItems.length ? stats.topItems.map((item, index) => <div className="rank-row" key={item.productName}><span className={`rank-number rank-${index + 1}`}>{index + 1}</span><span><strong>{item.productName}</strong><small>{item._sum.quantity ?? 0} terjual</small></span><b>{formatPrice(item._sum.lineTotal ?? 0)}</b></div>) : <p className="empty-analysis">Belum ada data produk.</p>}
        </section>
      </div>
      {isAdmin && <section className="stock-panel"><div><span className="panel-kicker">INVENTORI</span><h3>Perlu perhatian</h3></div><div className="stock-list">{stats.lowStock.length ? stats.lowStock.map((product) => <div className="stock-item" key={product.id}><span>{product.name}<small>{product.category}</small></span><b className={product.stock <= 5 ? "critical" : "warning"}>{product.stock} tersisa</b></div>) : <p className="empty-analysis">Semua stok dalam kondisi aman.</p>}</div></section>}
    </>}
  </div>;
}
