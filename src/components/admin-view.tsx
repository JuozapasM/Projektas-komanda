"use client";

import { useEffect, useState } from "react";
import { allTimeWinners, gameDates as fallbackDates, participantActivity, reservationEvents as fallbackEvents } from "@/lib/mock-data";
import { getReservationEvents } from "@/lib/supabase/queries";
import type { GameDate, WinnerTeam } from "@/lib/types";
import { WinnersBoard } from "./winners-board";

export function AdminView({ winners, onSaveWinners, onLogout }: { winners: WinnerTeam[]; onSaveWinners: (winners: WinnerTeam[]) => void; onLogout: () => void }) {
  const [dates, setDates] = useState<GameDate[]>(fallbackDates);
  const [showDateForm, setShowDateForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("19:00");
  const [showWinnerForm, setShowWinnerForm] = useState(false);
  const [winnerDraft, setWinnerDraft] = useState<WinnerTeam[]>(winners.map((winner) => ({ ...winner, players: [...winner.players, "", "", "", ""].slice(0, 4) })));
  const [events, setEvents] = useState(fallbackEvents);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      const nextEvents = await getReservationEvents();
      if (active) setEvents(nextEvents);
    }

    loadEvents();
    return () => {
      active = false;
    };
  }, []);

  function addGameDate(event: React.FormEvent) {
    event.preventDefault();
    if (!newDate || !newTime) return;

    const [, month, day] = newDate.split("-");
    const monthNames = ["SAUS", "VAS", "KOV", "BAL", "GEG", "BIR", "LIE", "RGP", "RGS", "SPA", "LAP", "GRU"];
    const date: GameDate = {
      id: `game-${Date.now()}`,
      label: `${day} ${monthNames[Number(month) - 1]}`,
      day: new Date(`${newDate}T12:00:00`).toLocaleDateString("lt-LT", { weekday: "short" }).replace(".", "").toUpperCase(),
      date: `${day} ${monthNames[Number(month) - 1]}`,
      time: newTime,
      seatsLeft: 16,
    };

    setDates([date, ...dates]);
    setNewDate("");
    setNewTime("19:00");
    setShowDateForm(false);
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

  function saveWinners(event: React.FormEvent) {
    event.preventDefault();
    onSaveWinners(winnerDraft.map((winner) => ({ ...winner, players: winner.players.map((player) => player.trim()).filter(Boolean) })));
    setShowWinnerForm(false);
  }

  const activeDate = dates[0] ?? fallbackDates[0];

  return (
    <main className="app-background">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>Auksinis Protas / Admin</span>
        </div>
        <div className="header-actions">
          <span className="mono">LAIMA</span>
          <button className="ghost-btn" onClick={onLogout}>Atsijungti</button>
        </div>
      </header>

      <section className="admin-page">
        <div className="dashboard-header">
          <div>
            <span className="mono eyebrow">Valdymo centras</span>
            <h1>Visa salė vienoje vietoje.</h1>
          </div>
          <div className="header-actions">
            <button className="ghost-btn" onClick={() => setShowWinnerForm(!showWinnerForm)}>Nugalėtojai</button>
            <button className="primary-btn" onClick={() => setShowDateForm(!showDateForm)}>+ Nauja žaidimo data</button>
          </div>
        </div>

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
            <button className="primary-btn" type="submit">Išsaugoti nugalėtojus</button>
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
            <button className="primary-btn" type="submit">Išsaugoti laiką</button>
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
            <strong>{activeDate.date}</strong>
          </div>
          <div className="metric">
            <span>REZERVACIJOS</span>
            <strong>09 / 16</strong>
          </div>
          <div className="metric">
            <span>PRISIJUNGĘ DABAR</span>
            <strong>{participantActivity.filter((participant) => participant.status === "Prisijungęs").length}</strong>
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
                    <span className={`status ${event.action === "Atšaukimas" ? "cancelled" : ""}`}>{event.action}</span>
                  </td>
                  <td>
                    <strong>{event.user}</strong>
                  </td>
                  <td>{event.seat}</td>
                  <td>{event.date}</td>
                  <td className="mono">{event.time}</td>
                  <td>
                    <button className="danger-btn">Atmesti</button>
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
