"use client";

import { useEffect, useState } from "react";
import { createGameDate } from "@/lib/supabase/admin";
import { getGameDates, getOnlineCount, getReservationEvents } from "@/lib/supabase/queries";
import { rejectReservation } from "@/lib/supabase/reservations";
import type { AllTimeWinner, GameDate, ReservationEvent, WinnerTeam } from "@/lib/types";
import { WinnersBoard } from "./winners-board";

function winnerFields(winners: WinnerTeam[]): WinnerTeam[] {
  return ([1, 2, 3] as const).map((place) => {
    const winner = winners.find((item) => item.place === place);
    return { place, players: [...(winner?.players ?? []), "", "", "", ""].slice(0, 4),
      points: winner?.points ?? 0, gameDate: winners[0]?.gameDate ?? "Paskutinis žaidimas" };
  });
}

export function AdminView({ userName, winners, allTimeWinners, onSaveWinners, onLogout }: {
  userName: string; winners: WinnerTeam[]; allTimeWinners: AllTimeWinner[];
  onSaveWinners: (winners: WinnerTeam[]) => Promise<string | null>; onLogout: () => Promise<string | null>;
}) {
  const [dates, setDates] = useState<GameDate[]>([]);
  const [showDateForm, setShowDateForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("19:00");
  const [showWinnerForm, setShowWinnerForm] = useState(false);
  const [winnerDraft, setWinnerDraft] = useState<WinnerTeam[]>(() => winnerFields(winners));
  const [events, setEvents] = useState<ReservationEvent[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [savingWinners, setSavingWinners] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [notice, setNotice] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAdminData() {
      const [nextDates, nextEvents, online] = await Promise.all([getGameDates(), getReservationEvents(), getOnlineCount()]);
      if (!active) return;
      if (nextDates.data) setDates(nextDates.data);
      if (nextEvents.data) setEvents(nextEvents.data);
      if (online.data !== null) setOnlineCount(online.data);
      setNotice(nextDates.error || nextEvents.error || online.error || "");
    }

    loadAdminData().catch(() => { if (active) setNotice("Nepavyko įkelti duomenų."); });
    return () => {
      active = false;
    };
  }, []);

  async function addGameDate(event: React.FormEvent) {
    event.preventDefault();
    if (!newDate || !newTime) return;

    setSavingDate(true);
    try {
      const result = await createGameDate(new Date(`${newDate}T${newTime}:00`).toISOString());
      if (result.error) { setNotice(result.error); return; }
      const nextDates = await getGameDates();
      if (nextDates.data) setDates(nextDates.data);
      setNotice(nextDates.error || "Žaidimo data išsaugota.");
      setNewDate("");
      setNewTime("19:00");
      setShowDateForm(false);
    } catch { setNotice("Nepavyko išsaugoti žaidimo datos."); }
    finally { setSavingDate(false); }
  }

  async function handleReject(reservationId: string) {
    setRejectingId(reservationId);
    try {
      const response = await rejectReservation(reservationId);
      if (response.error) { setNotice(response.error); return; }
      const [nextEvents, nextDates] = await Promise.all([getReservationEvents(), getGameDates()]);
      if (nextEvents.data) setEvents(nextEvents.data);
      if (nextDates.data) setDates(nextDates.data);
      setNotice(nextEvents.error || nextDates.error || "Rezervacija atmesta, vieta atlaisvinta.");
    } catch { setNotice("Nepavyko atmesti rezervacijos."); }
    finally { setRejectingId(null); }
  }

  function updateWinnerPlayer(place: number, playerIndex: number, value: string) {
    setWinnerDraft((current) =>
      current.map((winner) =>
        winner.place === place
          ? { ...winner, players: winner.players.map((player, index) => (index === playerIndex ? value : player)) }
          : winner,
      ),
    );
  }

  async function saveWinners(event: React.FormEvent) {
    event.preventDefault();
    setSavingWinners(true);
    try {
      const error = await onSaveWinners(winnerDraft.map((winner) => ({ ...winner, players: winner.players.map((player) => player.trim()).filter(Boolean) })));
      if (error) { setNotice(error); return; }
      setShowWinnerForm(false);
      setNotice("Nugalėtojai išsaugoti.");
    } catch { setNotice("Nepavyko išsaugoti nugalėtojų."); }
    finally { setSavingWinners(false); }
  }

  const activeDate = dates[0];

  return (
    <main className="app-background">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>Auksinis Protas / Admin</span>
        </div>
        <div className="header-actions">
          <span className="mono">{userName}</span>
          <button className="ghost-btn" onClick={async () => { const error = await onLogout(); if (error) setNotice(error); }}>Atsijungti</button>
        </div>
      </header>

      <section className="admin-page">
        <div className="dashboard-header">
          <div>
            <span className="mono eyebrow">Valdymo centras</span>
            <h1>Visa salė vienoje vietoje.</h1>
          </div>
          <div className="header-actions">
            <button className="ghost-btn" onClick={() => { if (!showWinnerForm) setWinnerDraft(winnerFields(winners)); setShowWinnerForm(!showWinnerForm); }}>Nugalėtojai</button>
            <button className="primary-btn" onClick={() => setShowDateForm(!showDateForm)}>+ Nauja žaidimo data</button>
          </div>
        </div>

        {notice && <div className="notice" role="status">{notice}</div>}

        {showWinnerForm && (
          <form className="panel winners-form" onSubmit={saveWinners}>
            <div className="panel-heading">
              <div>
                <h2>Įrašyti paskutinio žaidimo nugalėtojus</h2>
                <p>Į kiekvieną vietą įrašykite iki keturių žaidėjų.</p>
              </div>
              <span className="mono capacity">TOP 3</span>
            </div>
            {winnerDraft.map((winner) => (
              <div className="winner-form-row" key={winner.place}>
                <strong>{winner.place} vieta</strong>
                <div className="winner-player-fields">
                  {winner.players.map((player, playerIndex) => (
                    <input
                      key={`${winner.place}-${playerIndex}`}
                      value={player}
                      onChange={(event) => updateWinnerPlayer(winner.place, playerIndex, event.target.value)}
                      placeholder={`Žaidėjas ${playerIndex + 1}`}
                      aria-label={`${winner.place} vietos žaidėjas ${playerIndex + 1}`}
                    />
                  ))}
                </div>
                <label className="points-field">
                  Taškai
                  <input
                    type="number"
                    min="0"
                    value={winner.points}
                    onChange={(event) =>
                      setWinnerDraft((current) =>
                        current.map((item) => (item.place === winner.place ? { ...item, points: Number(event.target.value) } : item)),
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <button className="primary-btn" type="submit" disabled={savingWinners}>{savingWinners ? "Saugoma..." : "Išsaugoti nugalėtojus"}</button>
          </form>
        )}

        {showDateForm && (
          <form className="panel date-form" onSubmit={addGameDate}>
            <label className="field">
              Data
              <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required />
            </label>
            <label className="field">
              Pradžios laikas
              <input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} required />
            </label>
            <button className="primary-btn" type="submit" disabled={savingDate}>{savingDate ? "Saugoma..." : "Išsaugoti laiką"}</button>
          </form>
        )}

        <div className="admin-date-strip">
          {dates.map((date, index) => (
            <div className={`admin-date ${index === 0 ? "active" : ""}`} key={date.id}>
              <span className="mono">{date.day}</span>
              <strong>{date.date}</strong>
              <span>
                {date.time} / {date.seatsLeft} laisvos
              </span>
            </div>
          ))}
        </div>

        <div className="admin-grid">
          <div className="metric">
            <span>AKTYVI DATA</span>
            <strong>{activeDate?.date ?? "—"}</strong>
          </div>
          <div className="metric">
            <span>REZERVACIJOS</span>
            <strong>{activeDate ? Math.max(0, 16 - activeDate.seatsLeft) : 0} / 16</strong>
          </div>
          <div className="metric">
            <span>PRISIJUNGĘ DABAR</span>
            <strong>{onlineCount}</strong>
          </div>
        </div>

        <div className="panel room-panel">
          <div className="panel-heading">
            <div>
              <h2>Veiksmų istorija</h2>
              <p>Visos rezervacijos ir atšaukimai su serverio laiku.</p>
            </div>
            <span className="mono capacity">AUDIT LOG</span>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Veiksmas</th>
                <th>Dalyvis</th>
                <th>Vieta</th>
                <th>Žaidimas</th>
                <th>Tikslus laikas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className={`status ${event.action === "Atšaukimas" ? "cancelled" : event.action === "Atmesta" ? "rejected" : ""}`}>{event.action}</span>
                  </td>
                  <td>
                    <strong>{event.user}</strong>
                  </td>
                  <td>{event.seat}</td>
                  <td>{event.date}</td>
                  <td className="mono">{event.time}</td>
                  <td>
                    {event.rejectable && event.reservationId && (
                      <button
                        className="danger-btn"
                        disabled={rejectingId === event.reservationId}
                        onClick={() => handleReject(event.reservationId!)}
                      >
                        {rejectingId === event.reservationId ? "Atmetama..." : "Atmesti"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <WinnersBoard lastGameWinners={winners} allTimeWinners={allTimeWinners} />
      </section>
    </main>
  );
}
