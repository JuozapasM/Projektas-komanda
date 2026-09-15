"use client";

import { useEffect, useState } from "react";
import { createSeats, gameDates as fallbackGameDates } from "@/lib/mock-data";
import { getGameDates } from "@/lib/supabase/queries";
import { cancelSeatForUser, loadSeatBoard, reserveSeatForUser } from "@/lib/supabase/reservations";
import type { Seat } from "@/lib/types";

export function ParticipantDashboard({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [gameDates, setGameDates] = useState(fallbackGameDates);
  const [selectedDate, setSelectedDate] = useState(fallbackGameDates[0].id);
  const [seats, setSeats] = useState<Seat[]>(() => createSeats());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDates() {
      const nextDates = await getGameDates();
      if (!active) return;

      setGameDates(nextDates);
      setSelectedDate((current) => nextDates.some((game) => game.id === current) ? current : nextDates[0].id);
    }

    loadDates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSeats() {
      const nextSeats = await loadSeatBoard(selectedDate, userName);
      if (!active) return;
      setSeats(nextSeats);
    }

    loadSeats();
    return () => {
      active = false;
    };
  }, [selectedDate, userName]);

  const mine = seats.find((seat) => seat.status === "mine");
  const selectedGame = gameDates.find((game) => game.id === selectedDate) ?? gameDates[0];

  async function reserve() {
    if (mine) return;

    const response = await reserveSeatForUser(selectedDate, userName);
    if ("error" in response && response.error) {
      setNotice(response.error);
      return;
    }

    if (!response.seat) {
      setNotice("Nepavyko gauti rezervuotos vietos.");
      return;
    }

    const nextSeats = await loadSeatBoard(selectedDate, userName);
    setSeats(nextSeats);
    setNotice(`Jūsų vieta: ${response.seat.tableNumber} stalas, ${response.seat.seatNumber} vieta.`);
  }

  async function cancel() {
    const response = await cancelSeatForUser(selectedDate, userName);
    if (!response.ok) {
      setNotice(response.error || "Nepavyko atšaukti rezervacijos.");
      return;
    }

    const nextSeats = await loadSeatBoard(selectedDate, userName);
    setSeats(nextSeats);
    setNotice("Rezervacija atšaukta. Vieta vėl laisva.");
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
          <button className="ghost-btn" onClick={onLogout}>Atsijungti</button>
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
              onClick={() => {
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
                  {selectedGame.label} · Didžioji salė
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
                    {selectedGame.label} · {selectedGame.time}
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
                  <button className="danger-btn" onClick={cancel}>
                    Atšaukti rezervaciją
                  </button>
                </>
              ) : (
                <>
                  <p>Dar nesusirinkai savo vietos.</p>
                  <button className="primary-btn" onClick={reserve}>
                    Rezervuoti vietą
                  </button>
                </>
              )}

              {notice && <div className="notice">{notice}</div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
