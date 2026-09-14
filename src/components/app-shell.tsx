"use client";

import { useState } from "react";
import { AdminView } from "./admin-view";
import { ParticipantDashboard } from "./participant-dashboard";

export function AppShell() {
  const [session, setSession] = useState<"landing" | "participant" | "admin">("landing");
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (session === "participant") return <ParticipantDashboard userName={name} onLogout={() => setSession("landing")} />;
  if (session === "admin") return <AdminView onLogout={() => setSession("landing")} />;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || password.length < 4) { setError("Įrašykite vardą ir bent 4 simbolių slaptažodį."); return; }
    if (!register && name.toLowerCase() === "laima" && password === "laima26") { setSession("admin"); return; }
    setError("");
    setSession("participant");
  }

  return <main className="app-background">
    <header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>Auksinis Protas</span></div><span className="mono">ŽAIDIMŲ VAKARAI / 2026</span></header>
    <section className="landing"><div><span className="mono eyebrow">Klausimai. Komanda. Azartas.</span><h1>Vieta prie stalo<br /><em>jau laukia.</em></h1><p className="lede">Užsiregistruokite į artimiausią protmūšį ir gaukite atsitiktinę vietą viename iš keturių stalų.</p><div className="hero-note"><div><strong>04</strong><span>stalai</span></div><div><strong>16</strong><span>vietų</span></div><div><strong>01</strong><span>vakaro data</span></div></div></div><div className="login-card"><span className="mono eyebrow">Dalyvio paskyra</span><h2>{register ? "Pirmas vakaras?" : "Sveiki sugrįžę."}</h2><p>{register ? "Susikurkite vardą ir slaptažodį. Jokių el. laiškų, jokių papildomų žingsnių." : "Prisijunkite, kad matytumėte savo vietą ir artimiausius žaidimus."}</p><form className="form-stack" onSubmit={submit}><label className="field">Vardas<input value={name} onChange={(event) => setName(event.target.value)} placeholder="pvz. Ieva" autoComplete="username" /></label><label className="field">Slaptažodis<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="mažiausiai 4 simboliai" type="password" autoComplete={register ? "new-password" : "current-password"} /></label>{error && <span className="error">{error}</span>}<button className="primary-btn" type="submit">{register ? "Sukurti paskyrą" : "Prisijungti"}</button></form><button className="ghost-btn wide-btn" type="button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Jau turiu paskyrą" : "Registruotis pirmą kartą"}</button><div className="demo-hint">Administratoriaus prieiga: vardas <strong>Laima</strong>. Sistema neturi el. pašto, verifikacijos ar slaptažodžio atkūrimo.</div></div></section>
  </main>;
}