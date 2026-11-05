"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null);
    if (r?.ok) {
      location.href = "/";
      return;
    }
    const j = await r?.json().catch(() => null);
    setErr(j?.error || "Couldn't reach the planner. Check your connection.");
    setBusy(false);
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <h1>Cat&apos;s Planner</h1>
        <p>Enter your password to open your planner.</p>
        <div className="f">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        <div className="err">{err}</div>
        <button className="primary" type="submit" disabled={busy || !pw}>{busy ? "Opening…" : "Open planner"}</button>
      </form>
    </main>
  );
}
