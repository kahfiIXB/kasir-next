"use client";

import { useEffect, useState } from "react";

type ProductImageItem = { id: number; name: string; category: string; imageUrl: string | null };

export default function ProductImageManager() {
  const [products, setProducts] = useState<ProductImageItem[]>([]);
  const [files, setFiles] = useState<Record<number, File>>({});
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadProducts = async () => {
    const response = await fetch("/api/products");
    const result = await response.json().catch(() => []);
    if (!response.ok) throw new Error("Gagal memuat daftar menu.");
    setProducts(result);
  };

  useEffect(() => {
    loadProducts().catch(() => setMessage("Gagal memuat daftar menu."));
  }, []);

  const uploadImage = async (productId: number) => {
    const file = files[productId];
    if (!file) return;
    setSavingId(productId);
    setMessage("");
    const body = new FormData();
    body.set("image", file);
    try {
      const response = await fetch(`/api/products?id=${productId}`, { method: "PATCH", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Foto menu gagal disimpan.");
      setMessage(`Foto ${result.name ?? "menu"} berhasil disimpan.`);
      setFiles((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Foto menu gagal disimpan.");
    } finally {
      setSavingId(null);
    }
  };

  return <section className="admin-list product-image-manager"><div className="list-heading"><span className="panel-kicker">FOTO MENU</span><strong>Kelola gambar produk</strong></div><p className="image-manager-copy">Foto tersimpan di Cloudinary agar tetap tersedia setelah deployment.</p>{products.length === 0 ? <p className="empty-analysis">Belum ada menu.</p> : products.map((product) => <div className="product-image-row" key={product.id}><div className="product-image-thumb">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>{product.name.slice(0, 1).toUpperCase()}</span>}</div><span className="product-image-name"><strong>{product.name}</strong><small>{product.category} · {product.imageUrl ? "Foto tersedia" : "Belum ada foto"}</small></span><label className="image-file-control">{files[product.id] ? "Ganti file" : "Pilih foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setFiles((current) => ({ ...current, [product.id]: file })); }} /></label><button type="button" className="update-menu-button" disabled={!files[product.id] || savingId !== null} onClick={() => uploadImage(product.id)}>{savingId === product.id ? "Mengunggah..." : "Simpan foto"}</button></div>)}{message && <small className="form-message">{message}</small>}</section>;
}
