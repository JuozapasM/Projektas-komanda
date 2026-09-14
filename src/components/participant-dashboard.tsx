"use client";

import { useState } from "react";
import { allTimeWinners, createSeats, gameDates } from "@/lib/mock-data";
import type { Seat, WinnerTeam } from "@/lib/types";
import { WinnersBoard } from "./winners-board";

export function ParticipantDashboard({ userName, winners, onLogout }: { userName: string; winners: WinnerTeam[]; onLogout: () => void }) {
  const [selectedDate, setSelectedDate] = useState(gameDates[0].id);
  const [seats, setSeats] = useState<Seat[]>(createSeats());
  const [notice, setNotice] = useState("");
  const mine = seats.find((seat) => seat.status === "mine");
  const selectedGame = gameDates.find((game) => game.id === selectedDate) ?? gameDates[0];

  function reserve() {
    if (mine) return;
    const free = seats.filter((seat) => seat.status === "free");
    if (!free.length) { setNotice("Šiai datai laisvų vietų nebėra."); return; }
    const seat = free[Math.floor(Math.random() * free.length)];
    setSeats(seats.map((item) => item.id === seat.id ? { ...item, status: "mine", occupant: userName } : item));
    setNotice(`Jūsų vieta: ${seat.tableNumber} stalas, ${seat.seatNumber} vieta.`);
  }

  function cancel() {
    setSeats(seats.map((seat) => seat.status === "mine" ? { ...seat, status: "free", occupant: undefined } : seat));
    setNotice("Rezervacija atšaukta. Vieta vėl laisva.");
  }

  return <main className="app-background"><header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>Auksinis Protas</span></div><div className="header-actions"><span className="mono">{userName}</span><button className="ghost-btn" onClick={onLogout}>Atsijungti</button></div></header><section className="dashboard"><div className="dashboard-header"><div><span className="mono eyebrow">Tavo žaidimų kalendorius</span><h1>Kur sėdėsime?</h1></div><span className="mono">SEZONAS 04 / 2026</span></div><div className="date-strip">{gameDates.map((game) => <button className={`date-button ${selectedDate === game.id ? "active" : ""}`} key={game.id} onClick={() => { setSelectedDate(game.id); setNotice(""); }}><span className="mono">{game.day}</span><strong>{game.date}</strong><span>{game.time} / {game.seatsLeft} laisvos</span></button>)}</div><div className="room-grid"><div className="panel room-panel"><div className="panel-heading"><div><h2>{selectedGame.label} · Didžioji salė</h2><p>Vieta paskiriama atsitiktinai iš laisvų vietų.</p></div><span className="mono capacity">{seats.filter((seat) => seat.status === "free").length} LAISVOS</span></div><div className="tables">{[1, 2, 3, 4].map((table) => <div className="table-card" key={table}><div className="table-title"><strong>Stalas {table}</strong><span>4 VIETOS</span></div><div className="seat-list">{seats.filter((seat) => seat.tableNumber === table).map((seat) => <div className={`seat ${seat.status}`} key={seat.id}><span className="seat-number">0{seat.seatNumber}</span><span className="seat-name">{seat.status === "free" ? "" : seat.occupant}</span></div>)}</div></div>)}</div></div><div className="side-stack"><div className="panel reservation-card"><div className="panel-heading"><div><h2>Tavo rezervacija</h2><p>{selectedGame.label} · {selectedGame.time}</p></div></div>{mine ? <><div className="reservation-seat"><div className="seat-badge">{mine.tableNumber}</div><div><strong>{mine.seatNumber} vieta</strong><span>{mine.tableNumber} stalas / patvirtinta dabar</span></div></div><button className="danger-btn wide-btn" onClick={cancel}>Atšaukti rezervaciją</button></> : <><p>Kol kas vietos neturite. Paspauskite mygtuką ir sistema atsitiktinai parinks laisvą vietą.</p><button className="primary-btn wide-btn" onClick={reserve}>Rezervuoti atsitiktinę vietą</button></>}</div><div className="panel stats-card"><div className="stats-row"><span>Visa salė</span><strong>16 vietų</strong></div><div className="stats-row"><span>Užimta</span><strong>{seats.filter((seat) => seat.status !== "free").length} vietos</strong></div><div className="stats-row"><span>Prasidės</span><strong>{selectedGame.time}</strong></div></div></div></div></section><WinnersBoard lastGameWinners={winners} allTimeWinners={allTimeWinners} />{notice && <div className="toast">{notice}</div>}</main>;
}