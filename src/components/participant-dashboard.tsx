"use client";

import { useEffect, useState } from "react";
import { getGameDates } from "@/lib/supabase/queries";
import { cancelSeatForUser, loadSeatBoard, reserveSeatForUser } from "@/lib/supabase/reservations";
import type { AllTimeWinner, GameDate, Seat, WinnerTeam } from "@/lib/types";
import { WinnersBoard } from "./winners-board";

export function ParticipantDashboard({ userName, winners, allTimeWinners, onLogout }: {
  userName: string; winners: WinnerTeam[]; allTimeWinners: AllTimeWinner[]; onLogout: () => Promise<string | null>;
}) {
  const [gameDates, setGameDates] = useState<GameDate[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDates() {
      const nextDates = await getGameDates();
      if (!active) return;

      if (nextDates.error !== null) { setNotice(nextDates.error); return; }
      setGameDates(nextDates.data);
      setSelectedDate((current) => nextDates.data.some((game) => game.id === current) ? current : nextDates.data[0]?.id ?? "");
      if (!nextDates.data.length) setNotice("Šiuo metu nėra atvirų žaidimų datų.");
    }

    loadDates().catch(() => { if (active) setNotice("Nepavyko įkelti žaidimų."); });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSeats() {
      if (!selectedDate) return;
      const nextSeats = await loadSeatBoard(selectedDate);
      if (!active) return;
      if (nextSeats.error !== null) { setNotice(nextSeats.error); return; }
      setSeats(nextSeats.data);
    }

    loadSeats().catch(() => { if (active) setNotice("Nepavyko įkelti vietų."); });
    return () => {
      active = false;
    };
  }, [selectedDate]);

  const mine = seats.find((seat) => seat.status === "mine");
  const selectedGame = gameDates.find((game) => game.id === selectedDate) ?? gameDates[0];

  async function refreshBoard() {
    const [board, dates] = await Promise.all([loadSeatBoard(selectedDate), getGameDates()]);
    if (board.data) setSeats(board.data);
    if (dates.data) setGameDates(dates.data);
    return board.error || dates.error;
  }

  async function reserve() {
    if (mine || !selectedDate || busy) return;
    setBusy(true);
    try {
      const response = await reserveSeatForUser(selectedDate);
      if (response.error !== null) { setNotice(response.error); return; }
      const error = await refreshBoard();
      setNotice(error || `Jūsų vieta: ${response.data.tableNumber} stalas, ${response.data.seatNumber} vieta.`);
    } catch { setNotice("Nepavyko rezervuoti vietos."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await cancelSeatForUser(selectedDate);
      if (response.error !== null) { setNotice(response.error); return; }
      const error = await refreshBoard();
      setNotice(error || "Rezervacija atšaukta. Vieta vėl laisva.");
    } catch { setNotice("Nepavyko atšaukti rezervacijos."); }
    finally { setBusy(false); }
  }

  return (
    <main className="app-background">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>Auksinis Protas</span>
        </div>
        <div className="header-actions">
          <span className="mono">{userName}</span>
          <button className="ghost-btn" onClick={async () => { const error = await onLogout(); if (error) setNotice(error); }}>Atsijungti</button>
        </div>
      </header>

      <section className="dashboard">
        <div className="dashboard-header">
          <div>
            <span className="mono eyebrow">Tavo žaidimų kalendorius</span>
            <h1>Kur sėdėsime?</h1>
          </div>
          <span className="mono">SEZONAS 04 / 2026</span>
        </div>

        <div className="date-strip">
          {gameDates.map((game) => (
            <button
              className={`date-button ${selectedDate === game.id ? "active" : ""}`}
              key={game.id}
              disabled={busy}
              aria-pressed={selectedDate === game.id}
              onClick={() => {
                setSeats([]);
                setSelectedDate(game.id);
                setNotice("");
              }}
            >
              <span className="mono">{game.day}</span>
              <strong>{game.date}</strong>
              <span>
                {game.time} / {game.seatsLeft} laisvos
              </span>
            </button>
          ))}
        </div>

        <div className="room-grid">
          <div className="panel room-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {selectedGame?.label ?? "Žaidimas"} · Didžioji salė
                </h2>
                <p>Vieta paskiriama atsitiktinai iš laisvų vietų.</p>
              </div>
              <span className="mono capacity">{seats.filter((seat) => seat.status === "free").length} LAISVOS</span>
            </div>

            <div className="tables">
              {[1, 2, 3, 4].map((table) => (
                <div className="table-card" key={table}>
                  <div className="table-title">
                    <strong>Stalas {table}</strong>
                    <span>4 VIETOS</span>
                  </div>
                  <div className="seat-list">
                    {seats
                      .filter((seat) => seat.tableNumber === table)
                      .map((seat) => (
                        <div className={`seat ${seat.status}`} key={seat.id}>
                          <span className="seat-number">0{seat.seatNumber}</span>
                          <span className="seat-name">{seat.status === "free" ? "" : seat.occupant}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="side-stack">
            <div className="panel reservation-card">
              <div className="panel-heading">
                <div>
                  <h2>Tavo rezervacija</h2>
                  <p>
                    {selectedGame?.label ?? "Žaidimas"} · {selectedGame?.time ?? "—"}
                  </p>
                </div>
              </div>

              {mine ? (
                <>
                  <div className="reservation-seat">
                    <div className="seat-badge">{mine.tableNumber}</div>
                    <div>
                      <strong>
                        {mine.seatNumber} vieta
                      </strong>
                      <span>Vieta priskirta tau.</span>
                    </div>
                  </div>
                  <button className="danger-btn" disabled={busy} onClick={cancel}>
                    Atšaukti rezervaciją
                  </button>
                </>
              ) : (
                <>
                  <p>Dar nesusirinkai savo vietos.</p>
                  <button className="primary-btn" disabled={busy || !selectedDate} onClick={reserve}>
                    Rezervuoti vietą
                  </button>
                </>
              )}

              {notice && <div className="notice">{notice}</div>}
            </div>
          </div>
        </div>
      </section>

      <WinnersBoard lastGameWinners={winners} allTimeWinners={allTimeWinners} />
    </main>
  );
}
