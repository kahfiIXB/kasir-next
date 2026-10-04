"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PeriodSummaryView from "./summary-view";
import ProductImageManager from "./product-image-manager";

type Product = { id: number; name: string; category: string; price: number; stock: number; color: string; imageUrl?: string | null };
type CartLine = Product & { quantity: number };
type MemberRecord = { id: number; code: string; name: string; phone: string | null; discountPercent: number };
type AdminResource = "Produk" | "Member" | "Pengguna";
type SessionUser = { id: number; name: string; email: string; role: "ADMIN" | "CASHIER" };

const products: Product[] = [
  { id: 1, name: "Nasi Goreng Spesial", category: "Makanan", price: 28000, stock: 18, color: "coral" },
  { id: 2, name: "Ayam Geprek Sambal Ijo", category: "Makanan", price: 32000, stock: 12, color: "yellow" },
  { id: 3, name: "Mie Goreng Jawa", category: "Makanan", price: 24000, stock: 9, color: "blue" },
  { id: 4, name: "Es Kopi Gula Aren", category: "Minuman", price: 18000, stock: 24, color: "brown" },
  { id: 5, name: "Teh Tarik Dingin", category: "Minuman", price: 14000, stock: 31, color: "green" },
  { id: 6, name: "Pisang Goreng Keju", category: "Snack", price: 20000, stock: 7, color: "orange" },
];

const formatPrice = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

type DashboardStats = {
  revenue: number;
  transactionCount: number;
  averageTransaction: number;
  transactions: { id: number; invoiceNumber: string; total: number; createdAt: string; cashier: { name: string } }[];
  lowStock: { id: number; name: string; stock: number; category: string }[];
  topItems: { productName: string; _sum: { quantity: number | null; lineTotal: number | null } }[];
};

function SummaryView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard").then(async (response) => {
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "Data analitik tidak tersedia.");
      else setStats(result);
    }).catch(() => setError("Gagal memuat analitik."));
  }, []);

  if (error) return <div className="placeholder-view"><div className="placeholder-icon">!</div><h2>{error}</h2><p>Coba muat ulang halaman setelah database siap.</p></div>;
  if (!stats) return <div className="auth-loading">Memuat analitik penjualan...</div>;
  return <div className="summary-view"><div className="summary-intro"><div><p className="eyebrow">PERFORMA TOKO · HARI INI</p><h2>Ringkasan penjualan</h2><p>Pantau kesehatan operasional Ruang Rasa secara langsung.</p></div><button className="outline-button" onClick={() => window.location.reload()}>↻ Muat ulang</button></div><div className="metric-grid"><div className="metric-card accent"><span>Omzet hari ini</span><strong>{formatPrice(stats.revenue)}</strong><small>Transaksi berstatus lunas</small></div><div className="metric-card"><span>Total transaksi</span><strong>{stats.transactionCount}</strong><small>Pesanan diproses hari ini</small></div><div className="metric-card"><span>Rata-rata transaksi</span><strong>{formatPrice(stats.averageTransaction)}</strong><small>Nilai per pesanan</small></div></div><div className="analysis-grid"><section className="analysis-panel"><div className="analysis-heading"><div><span className="panel-kicker">AKTIVITAS TERBARU</span><h3>Transaksi hari ini</h3></div><span className="live-pill"><i className="live-dot" /> Live</span></div>{stats.transactions.length ? stats.transactions.map((transaction) => <div className="activity-row" key={transaction.id}><span className="activity-icon">↗</span><span><strong>{transaction.invoiceNumber}</strong><small>{transaction.cashier.name} · {new Date(transaction.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</small></span><b>{formatPrice(transaction.total)}</b></div>) : <p className="empty-analysis">Belum ada transaksi hari ini.</p>}</section><section className="analysis-panel"><div className="analysis-heading"><div><span className="panel-kicker">MENU TERLARIS</span><h3>Produk favorit</h3></div></div>{stats.topItems.length ? stats.topItems.map((item, index) => <div className="rank-row" key={item.productName}><span className={`rank-number rank-${index + 1}`}>{index + 1}</span><span><strong>{item.productName}</strong><small>{item._sum.quantity ?? 0} terjual</small></span><b>{formatPrice(item._sum.lineTotal ?? 0)}</b></div>) : <p className="empty-analysis">Belum ada data produk.</p>}</section></div><section className="stock-panel"><div><span className="panel-kicker">INVENTORI</span><h3>Perlu perhatian</h3></div><div className="stock-list">{stats.lowStock.length ? stats.lowStock.map((product) => <div className="stock-item" key={product.id}><span>{product.name}<small>{product.category}</small></span><b className={product.stock <= 5 ? "critical" : "warning"}>{product.stock} tersisa</b></div>) : <p className="empty-analysis">Semua stok dalam kondisi aman.</p>}</div></section></div>;
}

function MemberAdminView() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [editingMember, setEditingMember] = useState<{ id: number; name: string; phone: string; discountPercent: string } | null>(null);

  const loadMembers = async () => {
    const response = await fetch("/api/members");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Gagal memuat data member.");
    setMembers(result);
  };

  useEffect(() => {
    loadMembers().catch(() => setMessage("Gagal memuat data member."));
    fetch("/api/auth/me").then((response) => response.json()).then((result) => setIsAdmin(result.user?.role === "ADMIN")).catch(() => setIsAdmin(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, discountPercent: isAdmin ? Number(discountPercent) : 0 }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Member berhasil ditambahkan." : result.error ?? "Gagal menyimpan member.");
    if (response.ok) {
      setName("");
      setPhone("");
      setDiscountPercent("10");
      await loadMembers();
    }
  };

  const remove = async (id: number) => {
    const response = await fetch(`/api/members?id=${id}`, { method: "DELETE" });
    if (response.ok) await loadMembers();
  };

  const saveMember = async () => {
    if (!editingMember) return;
    const response = await fetch(`/api/members?id=${editingMember.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingMember.name, phone: editingMember.phone, discountPercent: Number(editingMember.discountPercent) }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Member berhasil diperbarui." : result.error ?? "Gagal memperbarui member.");
    if (response.ok) {
      setEditingMember(null);
      await loadMembers();
    }
  };

  const openMemberEditor = (member: MemberRecord) => {
    setEditingMember({ id: member.id, name: member.name, phone: member.phone ?? "", discountPercent: String(member.discountPercent) });
  };

  return <><div className="admin-view"><div className="admin-view-heading"><div><p className="eyebrow">PENGELOLAAN TOKO</p><h2>Member</h2><p>Kelola pelanggan dan diskon member.</p></div><span className="record-count">{members.length} data aktif</span></div><div className="admin-content"><form className="admin-form" onSubmit={submit}><span className="panel-kicker">TAMBAH MEMBER</span><h3>Data baru</h3><label>Nama<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama pelanggan" required /></label><label>No. telepon<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>{isAdmin && <label>Diskon member (%)<input type="number" min="0" max="100" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} required /></label>}<button className="save-button" disabled={isAdmin === null}>Simpan Member</button>{message && <small className="form-message">{message}</small>}</form><section className="admin-list"><div className="list-heading"><span className="panel-kicker">DATA TERSIMPAN</span><strong>Member aktif</strong></div>{members.length === 0 ? <p className="empty-analysis">Belum ada member.</p> : members.map((member) => <div className="admin-row" key={member.id}><span className="row-avatar">{member.name.slice(0, 1).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.code} · {member.phone ?? "Tanpa nomor"} · Diskon {member.discountPercent}%</small></span>{isAdmin && <><button type="button" className="edit-member-button" onClick={() => openMemberEditor(member)}>Edit</button><button type="button" className="delete-button" onClick={() => remove(member.id)} aria-label={`Nonaktifkan ${member.name}`}>×</button></>}</div>)}</section></div></div>{editingMember && <div className="modal-backdrop" onClick={() => setEditingMember(null)}><div className="edit-modal" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setEditingMember(null)} aria-label="Tutup">×</button><span className="panel-kicker">EDIT MEMBER</span><h2>{editingMember.name}</h2><label>Nama<input value={editingMember.name} onChange={(event) => setEditingMember({ ...editingMember, name: event.target.value })} required /></label><label>No. telepon<input value={editingMember.phone} onChange={(event) => setEditingMember({ ...editingMember, phone: event.target.value })} /></label><label>Diskon member (%)<input type="number" min="0" max="100" step="1" value={editingMember.discountPercent} onChange={(event) => setEditingMember({ ...editingMember, discountPercent: event.target.value })} required /></label><button type="button" className="save-button" onClick={saveMember}>Simpan perubahan</button></div></div>}</>;
}

function AdminResourceView({ resource }: { resource: AdminResource }) {
  if (resource === "Member") return <MemberAdminView />;
  if (resource === "Pengguna") return <UserAdminView />;
  if (resource === "Produk") return <><AdminResourceDataView resource={resource} /><ProductImageManager /></>;
  return <AdminResourceDataView resource={resource} />;
}

type UserRecord = { id: number; name: string; username: string; email: string; role: string; isActive: boolean };

function UserAdminView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    const response = await fetch("/api/users");
    const result = await response.json().catch(() => []);
    if (!response.ok) throw new Error(result.error ?? "Gagal memuat pengguna.");
    setUsers(result);
  };

  useEffect(() => { loadUsers().catch(() => setMessage("Gagal memuat pengguna.")); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, email, password }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Akun kasir berhasil dibuat." : result.error ?? "Gagal membuat akun kasir.");
    if (response.ok) {
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      await loadUsers();
    }
  };

  const remove = async (id: number) => {
    const response = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    if (response.ok) await loadUsers();
  };

  return <div className="admin-view"><div className="admin-view-heading"><div><p className="eyebrow">PENGELOLAAN TOKO</p><h2>Pengguna</h2><p>Kelola akun kasir dan username untuk login.</p></div><span className="record-count">{users.length} akun</span></div><div className="admin-content"><form className="admin-form" onSubmit={submit}><span className="panel-kicker">TAMBAH PENGGUNA</span><h3>Akun kasir baru</h3><label>Nama<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama kasir" required /></label><label>Username<input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" autoComplete="off" required /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password sementara<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button className="save-button">Simpan Pengguna</button>{message && <small className="form-message">{message}</small>}</form><section className="admin-list"><div className="list-heading"><span className="panel-kicker">DATA TERSIMPAN</span><strong>Pengguna aktif</strong></div>{users.length === 0 ? <p className="empty-analysis">Belum ada pengguna.</p> : users.map((user) => <div className="admin-row" key={user.id}><span className="row-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>@{user.username} · {user.email} · {user.role === "ADMIN" ? "Administrator" : "Kasir"}</small></span>{user.isActive && <button type="button" className="delete-button" onClick={() => remove(user.id)} aria-label={`Nonaktifkan ${user.name}`}>×</button>}</div>)}</section></div></div>;
}

function AdminResourceDataView({ resource }: { resource: AdminResource }) {
  const endpoint = resource === "Produk" ? "/api/products" : resource === "Member" ? "/api/members" : "/api/users";
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ name: "", category: "Makanan", price: "", stock: "", email: "", password: "", phone: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingProduct, setEditingProduct] = useState<{ id: unknown; name: string; price: string; stock: string } | null>(null);
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState("");

  const load = async () => {
    try {
      const response = await fetch(endpoint);
      const result = await response.json();
      if (!response.ok || !Array.isArray(result)) {
        setMessage(result.error ?? "Data tidak dapat dimuat.");
        setItems([]);
        return;
      }
      setItems(result);
    } catch {
      setMessage("Gagal terhubung ke server.");
      setItems([]);
    }
  };
  useEffect(() => { load(); }, [endpoint]);
  useEffect(() => {
    if (!imageFile) { setImagePreview(""); return; }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);
  useEffect(() => {
    if (!editingImageFile) return;
    const previewUrl = URL.createObjectURL(editingImageFile);
    setEditingImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editingImageFile]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    let requestBody: FormData | string;
    const headers: HeadersInit = {};
    if (resource === "Produk") {
      const productData = new FormData();
      productData.set("name", form.name);
      productData.set("category", form.category);
      productData.set("price", form.price);
      productData.set("stock", form.stock || "0");
      if (imageFile) productData.set("image", imageFile);
      requestBody = productData;
    } else {
      const body = resource === "Member" ? { name: form.name, phone: form.phone } : { name: form.name, email: form.email, password: form.password };
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
    const response = await fetch(endpoint, { method: "POST", headers, body: requestBody });
    const result = await response.json();
    setMessage(response.ok ? `${resource} berhasil ditambahkan.` : result.error ?? "Gagal menyimpan data.");
    if (response.ok) { setForm({ name: "", category: "Makanan", price: "", stock: "", email: "", password: "", phone: "" }); setImageFile(null); load(); }
  };

  const remove = async (id: unknown) => {
    await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    load();
  };
  const updateProduct = async () => {
    if (!editingProduct) return;
    const body = new FormData();
    body.set("stock", editingProduct.stock);
    body.set("price", editingProduct.price);
    if (editingImageFile) body.set("image", editingImageFile);
    const response = await fetch(`/api/products?id=${editingProduct.id}`, { method: "PATCH", body });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Menu berhasil diperbarui." : result.error ?? "Menu gagal diperbarui.");
    if (response.ok) {
      setEditingProduct(null);
      setEditingImageFile(null);
      setEditingImagePreview("");
      await load();
    }
  };
  const openProductEditor = () => {
    const item = items.find((entry) => String(entry.id) === selectedProductId);
    if (item) {
      setEditingImageFile(null);
      setEditingImagePreview(String(item.imageUrl ?? ""));
      setEditingProduct({ id: item.id, name: String(item.name ?? ""), price: String(item.price ?? 0), stock: String(item.stock ?? 0) });
    }
  };
  return <><div className="admin-view"><div className="admin-view-heading"><div><p className="eyebrow">PENGELOLAAN TOKO</p><h2>{resource}</h2><p>Kelola data {resource.toLowerCase()} Ruang Rasa dari satu tempat.</p></div><span className="record-count">{items.length} data aktif</span></div><div className="admin-content"><form className="admin-form" onSubmit={submit}><span className="panel-kicker">TAMBAH {resource.toUpperCase()}</span><h3>Data baru</h3><label>Nama<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={resource === "Produk" ? "Nama menu" : resource === "Member" ? "Nama pelanggan" : "Nama kasir"} required /></label>{resource === "Produk" && <><label>Kategori<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Makanan</option><option>Minuman</option><option>Snack</option></select></label><div className="form-split"><label>Harga<input type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label>Stok<input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label></div><label>Foto menu<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} required />{imagePreview && <img className="image-preview" src={imagePreview} alt="Preview foto menu" />}</label></>}{resource === "Member" && <label>No. telepon<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>}{resource === "Pengguna" && <><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label>Password sementara<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} required /></label></>}<button className="save-button">Simpan {resource}</button>{resource === "Produk" && items.length > 0 && <div className="quick-update"><select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">Pilih menu untuk update</option>{items.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}</select><button type="button" className="update-menu-button" onClick={openProductEditor} disabled={!selectedProductId}>Update menu</button></div>}{message && <small className="form-message">{message}</small>}</form><section className="admin-list"><div className="list-heading"><span className="panel-kicker">DATA TERSIMPAN</span><strong>{resource} aktif</strong></div>{items.length === 0 ? <p className="empty-analysis">Belum ada data.</p> : items.map((item) => <div className="admin-row" key={String(item.id)}><span className={`row-avatar ${resource === "Produk" ? "product-list-image" : ""}`}>{resource === "Produk" && item.imageUrl ? <img src={String(item.imageUrl)} alt="" /> : String(item.name ?? "?").slice(0, 1).toUpperCase()}</span><span><strong>{String(item.name ?? "-")}</strong><small>{resource === "Produk" ? `${String(item.category)} · ${formatPrice(Number(item.price))} · stok ${String(item.stock)}` : resource === "Member" ? `${String(item.code ?? "")} · ${String(item.phone ?? "Tanpa nomor")}` : `${String(item.email ?? "")} · ${String(item.role ?? "")}`}</small></span><button className="delete-button" onClick={() => remove(item.id)} aria-label={`Nonaktifkan ${String(item.name)}`}>×</button></div>)}</section></div></div>{editingProduct && <div className="modal-backdrop" onClick={() => setEditingProduct(null)}><div className="edit-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setEditingProduct(null)}>×</button><span className="panel-kicker">UPDATE MENU</span><h2>{editingProduct.name}</h2><label>Harga<input type="number" value={editingProduct.price} onChange={(event) => setEditingProduct({ ...editingProduct, price: event.target.value })} /></label><label>Stok<input type="number" min="0" value={editingProduct.stock} onChange={(event) => setEditingProduct({ ...editingProduct, stock: event.target.value })} /></label><button className="save-button" onClick={updateProduct}>Simpan perubahan</button></div></div>}</>;
}

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [activeMenu, setActiveMenu] = useState("Kasir");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [category, setCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [paid, setPaid] = useState(100000);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) { router.replace("/login"); return; }
        const result = await response.json();
        setSessionUser(result.user);
        const productsResponse = await fetch("/api/products");
        if (productsResponse.ok) setCatalog(await productsResponse.json());
        setAuthChecked(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (activeMenu !== "Kasir") return;
    fetch("/api/members").then(async (response) => {
      if (response.ok) setMembers(await response.json());
    }).catch(() => setMembers([]));
  }, [activeMenu]);

  const visibleProducts = catalog.filter((product) =>
    product.stock > 0 && (category === "Semua" || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase()),
  );
  const subtotal = useMemo(() => cart.reduce((total, item) => total + item.price * item.quantity, 0), [cart]);
  const selectedMember = members.find((member) => String(member.id) === selectedMemberId) ?? null;
  const discount = selectedMember ? Math.round(subtotal * selectedMember.discountPercent / 100) : 0;
  const total = subtotal - discount;
  const change = paid - total;
  const [paymentError, setPaymentError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
  };

  const changeQuantity = (id: number, amount: number) => {
    setCart((current) => current.flatMap((item) => item.id === id && item.quantity + amount <= 0 ? [] : item.id === id ? [{ ...item, quantity: item.quantity + amount }] : [item]));
  };

  const handlePayment = async () => {
    setSavingPayment(true);
    setPaymentError("");
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })), memberId: selectedMember?.id ?? null, paidAmount: paid }),
    });
    const result = await response.json();
    if (!response.ok) setPaymentError(result.error ?? "Transaksi gagal disimpan.");
    else {
      setCatalog((current) => current.map((product) => {
        const purchased = cart.find((item) => item.id === product.id);
        return purchased ? { ...product, stock: Math.max(0, product.stock - purchased.quantity) } : product;
      }));
      setShowReceipt(true);
    }
    setSavingPayment(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const availableMenus = sessionUser?.role === "ADMIN" ? ["Kasir", "Ringkasan", "Produk", "Member", "Pengguna"] : ["Kasir", "Ringkasan"];
  const currentDateLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()).toLocaleUpperCase("id-ID");

  if (!authChecked) return <main className="auth-loading">Memuat ruang kerja...</main>;

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Tutup menu navigasi" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} id="primary-sidebar">
        <div className="brand"><span className="brand-mark">K</span><span>kasir<span className="brand-dot">.</span></span></div>
        <div className="store-switcher"><span className="store-avatar">R</span><span><strong>Ruang Rasa</strong><small>Outlet utama</small></span><span className="chevron">⌄</span></div>
        <p className="nav-label">MENU UTAMA</p>
        <nav>
          {availableMenus.map((menu) => <button key={menu} className={`nav-item ${activeMenu === menu ? "active" : ""}`} onClick={() => { setActiveMenu(menu); setSidebarOpen(false); }}><span className={`nav-icon icon-${menu.toLowerCase()}`} />{menu}{menu === "Kasir" && <span className="nav-badge">2</span>}</button>)}
        </nav>
        <p className="nav-label lower-label">LAINNYA</p>
        <button className="nav-item"><span className="nav-icon icon-settings" />Pengaturan</button>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><strong>Butuh bantuan?</strong><small>Pelajari cara kerja Kasir.</small><button>Mulai tur <span>→</span></button></div><div className="profile"><span className="profile-avatar">{sessionUser?.name.slice(0, 2).toUpperCase()}</span><span><strong>{sessionUser?.name}</strong><small>{sessionUser?.role === "ADMIN" ? "Administrator" : "Kasir"}</small></span><button className="more-button" onClick={handleLogout} aria-label="Keluar">↪</button></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="menu-toggle" aria-label="Buka menu navigasi" aria-expanded={sidebarOpen} aria-controls="primary-sidebar" onClick={() => setSidebarOpen((open) => !open)}><span /><span /><span /></button><div className="topbar-title"><p className="eyebrow">{currentDateLabel}</p><h1>{activeMenu === "Kasir" ? "Buat penjualan baru" : activeMenu}</h1></div><div className="top-actions"><button className="icon-button" aria-label="Notifikasi">♧<i /></button><button className="outline-button">⌁ <span>Shortcut</span></button></div></header>
        {activeMenu === "Kasir" ? <div className="pos-layout">
          <section className="catalog-panel"><div className="catalog-toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari menu atau scan barcode..." /><kbd>⌘ K</kbd></div><button className="filter-button">☷ Filter</button></div><div className="category-tabs">{["Semua", "Makanan", "Minuman", "Snack"].map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}<span>{item === "Semua" ? catalog.length : catalog.filter((product) => product.category === item).length}</span></button>)}</div><div className="product-grid">{visibleProducts.map((product) => <button className="product-card" key={product.id} onClick={() => addToCart(product)}>{product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <div className={`product-art ${product.color}`}><span>{product.category === "Minuman" ? "◒" : product.category === "Snack" ? "✦" : "⌁"}</span></div>}<div className="product-info"><strong>{product.name}</strong><span>{product.category} <em>•</em> Stok {product.stock}</span><b>{formatPrice(product.price)}</b></div><span className="add-product">+</span></button>)}</div><div className="catalog-footer"><span><i className="live-dot" /> Inventori ter-update dari database</span><button>Lihat semua produk <span>→</span></button></div></section>
          <aside className="cart-panel"><div className="cart-heading"><div><span className="panel-kicker">TRANSAKSI SAAT INI</span><h2>Pesanan baru <span className="order-number">#0248</span></h2></div><button className="trash-button" onClick={() => setCart([])} aria-label="Kosongkan pesanan">⌫</button></div><div className="customer-row"><span className="customer-icon">♙</span><span className="member-select-copy"><small>Pelanggan</small><strong>{selectedMember ? `${selectedMember.code} · ${selectedMember.name}` : "Pelanggan umum"}</strong></span><select className="member-select" aria-label="Pilih member" value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}><option value="">Pilih member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.code} · {member.name}</option>)}</select></div><div className="cart-lines">{cart.length === 0 ? <div className="empty-cart">Belum ada item di pesanan</div> : cart.map((item) => <div className="cart-line" key={item.id}><div className={`mini-art ${item.color}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.category === "Minuman" ? "◒" : "⌁"}</div><div className="line-copy"><strong>{item.name}</strong><span>{formatPrice(item.price)}</span></div><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)}>+</button></div><b>{formatPrice(item.price * item.quantity)}</b></div>)}</div><div className="payment-area"><div className="summary-row"><span>Subtotal <small>{cart.reduce((count, item) => count + item.quantity, 0)} item</small></span><b>{formatPrice(subtotal)}</b></div><div className="summary-row discount-row"><span>Diskon member</span><b>{discount ? `− ${formatPrice(discount)}` : "Rp 0"}</b></div><div className="total-row"><span>Total pembayaran</span><strong>{formatPrice(total)}</strong></div><label className="paid-label">Uang diterima <div className="paid-input"><span>Rp</span><input type="number" value={paid} onChange={(event) => setPaid(Number(event.target.value))} /></div></label><div className={`change-row ${change < 0 ? "not-enough" : ""}`}><span>{change < 0 ? "Kurang" : "Kembalian"}</span><b>{formatPrice(Math.abs(change))}</b></div>{paymentError && <p className="payment-error">{paymentError}</p>}<button className="pay-button" disabled={!cart.length || change < 0 || savingPayment} onClick={handlePayment}>{savingPayment ? "Menyimpan transaksi..." : "Bayar & cetak struk"} <span>→</span></button></div></aside>
        </div> : activeMenu === "Ringkasan" ? <PeriodSummaryView role={sessionUser?.role === "ADMIN" ? "ADMIN" : "CASHIER"} /> : ["Produk", "Member", "Pengguna"].includes(activeMenu) ? <AdminResourceView resource={activeMenu as AdminResource} /> : <div className="placeholder-view"><div className="placeholder-icon">✦</div><h2>{activeMenu} sedang disiapkan</h2><p>Modul ini akan terhubung ke data Laragon setelah database diaktifkan.</p><button className="pay-button" onClick={() => setActiveMenu("Kasir")}>Kembali ke kasir</button></div>}
      </section>
      {showReceipt && <div className="modal-backdrop" onClick={() => setShowReceipt(false)}><div className="receipt-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowReceipt(false)}>×</button><span className="receipt-logo">kasir<span>.</span></span><p className="receipt-muted">RUANG RASA · OUTLET UTAMA</p><h2>Pembayaran berhasil</h2><div className="receipt-total">{formatPrice(total)}</div><div className="receipt-divider" />{cart.map((item) => <div className="receipt-line" key={item.id}><span>{item.quantity} × {item.name}</span><b>{formatPrice(item.price * item.quantity)}</b></div>)}<div className="receipt-divider" /><div className="receipt-line"><span>Kembalian</span><b>{formatPrice(change)}</b></div><button className="print-button" onClick={() => window.print()}>⌁ Cetak / simpan struk</button><button className="new-order" onClick={() => { setCart([]); setShowReceipt(false); }}>Transaksi baru</button></div></div>}
    </main>
  );
}
