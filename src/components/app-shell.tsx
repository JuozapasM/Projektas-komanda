"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "@/lib/auth";
import { AdminView } from "./admin-view";
import { ParticipantDashboard } from "./participant-dashboard";
import { WinnersBoard } from "./winners-board";
import { getWinners, saveWinnerResults } from "@/lib/supabase/winners";
import type { AllTimeWinner, WinnerTeam } from "@/lib/types";

export function AppShell() {
  const [session, setSession] = useState<"landing" | "participant" | "admin">("landing");
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [winners, setWinners] = useState<WinnerTeam[]>([]);
  const [allTimeWinners, setAllTimeWinners] = useState<AllTimeWinner[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    async function restore() {
      const [userResult, winnerResult] = await Promise.all([getCurrentUser(), getWinners()]);
      if (!active) return;
      if (winnerResult.data) {
        setWinners(winnerResult.data.winners);
        setAllTimeWinners(winnerResult.data.allTime);
      }
      if (userResult.error || winnerResult.error) setError(userResult.error || winnerResult.error || "");
      if (userResult.data) {
        setName(userResult.data.name);
        setSession(userResult.data.role);
      }
      setIsRestoring(false);
    }
    restore().catch(() => {
      if (active) { setError("Nepavyko įkelti duomenų. Bandykite dar kartą."); setIsRestoring(false); }
    });
    return () => { active = false; };
  }, []);

  async function logout(): Promise<string | null> {
    try {
      const result = await logoutUser();
      if (result.error !== null) return result.error;
      setPassword("");
      setName("");
      setError("");
      setSession("landing");
      return null;
    } catch { return "Nepavyko atsijungti. Bandykite dar kartą."; }
  }

  async function persistWinners(next: WinnerTeam[]) {
    const result = await saveWinnerResults(next);
    if (result.error !== null) return result.error;
    setWinners(result.data);
    return null;
  }

  if (session === "participant") return <ParticipantDashboard userName={name} onLogout={logout} />;
  if (session === "admin") return <AdminView userName={name} winners={winners} allTimeWinners={allTimeWinners} onSaveWinners={persistWinners} onLogout={logout} />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || password.length < 4) {
      setError("Įrašykite vardą ir bent 4 simbolių slaptažodį.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    let result;
    try {
      result = register ? await registerUser(name, password) : await loginUser(name, password);
    } catch {
      setIsSubmitting(false);
      setError("Nepavyko prisijungti. Bandykite dar kartą.");
      return;
    }
    const user = result.data;

    setIsSubmitting(false);

    if (!user) {
      setError(result.error || "Nepavyko prisijungti.");
      return;
    }

    setName(user.name);
    setPassword("");

    if (user.role === "admin") {
      setSession("admin");
      return;
    }

    setSession("participant");
  }

  return (
    <main className="app-background">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>Auksinis Protas</span>
        </div>
        <span className="mono">ŽAIDIMŲ VAKARAI / 2026</span>
      </header>

      <section className="landing">
        <div>
          <span className="mono eyebrow">Klausimai. Komanda. Azartas.</span>
          <h1>
            Vieta prie stalo
            <br />
            <em>jau laukia.</em>
          </h1>
          <p className="lede">Užsiregistruokite į artimiausią protmūšį ir gaukite atsitiktinę vietą viename iš keturių stalų.</p>
          <div className="hero-note">
            <div>
              <strong>04</strong>
              <span>stalai</span>
            </div>
            <div>
              <strong>16</strong>
              <span>vietų</span>
            </div>
            <div>
              <strong>01</strong>
              <span>vakaro data</span>
            </div>
          </div>
        </div>

        <div className="login-card">
          <span className="mono eyebrow">Dalyvio paskyra</span>
          <h2>{register ? "Pirmas vakaras?" : "Sveiki sugrįžę."}</h2>
          <p>{register ? "Susikurkite vardą ir slaptažodį. Jokių el. laiškų, jokių papildomų žingsnių." : "Prisijunkite, kad matytumėte savo vietą ir artimiausius žaidimus."}</p>

          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              Vardas
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="pvz. Ieva" autoComplete="username" />
            </label>
            <label className="field">
              Slaptažodis
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="mažiausiai 4 simboliai" type="password" autoComplete={register ? "new-password" : "current-password"} />
            </label>
            {error && <span className="error">{error}</span>}
            <button className="primary-btn" type="submit" disabled={isSubmitting || isRestoring}>
              {isRestoring ? "Kraunama..." : isSubmitting ? "Keliama..." : register ? "Sukurti paskyrą" : "Prisijungti"}
            </button>
          </form>

          <button
            className="ghost-btn wide-btn"
            type="button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Jau turiu paskyrą" : "Registruotis pirmą kartą"}
          </button>

          <div className="demo-hint">
            Prisijunkite savo vardu ir slaptažodžiu. Dėl paskyros pagalbos kreipkitės į žaidimo organizatorių.
          </div>
        </div>
      </section>

      <WinnersBoard lastGameWinners={winners} allTimeWinners={allTimeWinners} />
    </main>
  );
}
