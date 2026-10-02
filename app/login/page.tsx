"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Login gagal.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Coba lagi beberapa saat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand"><span className="brand-mark">K</span><strong>kasir<span>.</span></strong></div>
        <p className="eyebrow">RUANG RASA · OUTLET UTAMA</p>
        <h1>Selamat datang kembali</h1>
        <p className="login-copy">Masuk untuk mengelola penjualan dan operasional toko.</p>
        <form onSubmit={submit}>
          <label>Username<input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="login-error">{error}</p>}
          <button className="login-submit" disabled={loading}>{loading ? "Memeriksa..." : "Masuk ke dashboard →"}</button>
        </form>
        <small className="login-note">Akun kasir dibuat oleh administrator toko.</small>
      </section>
      <aside className="login-aside"><span className="aside-kicker">RUANG RASA / {currentYear}</span><h2>Jaga ritme toko.<br /><em>Satu transaksi</em><br />setiap kali.</h2><p>Semua yang kamu butuhkan untuk melayani pelanggan dengan lebih cepat dan rapi.</p><div className="aside-stamp">RR</div></aside>
    </main>
  );
}
