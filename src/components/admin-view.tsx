"use client";

import { useState } from "react";
import { gameDates, participantActivity, reservationEvents } from "@/lib/mock-data";
import type { GameDate } from "@/lib/types";

export function AdminView({ onLogout }: { onLogout: () => void }) {
  const [dates, setDates] = useState<GameDate[]>(gameDates);
  const [showDateForm, setShowDateForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("19:00");
  const activeDate = dates[0];

  function addGameDate(event: React.FormEvent) {
    event.preventDefault();
    if (!newDate || !newTime) return;
    const [, month, day] = newDate.split("-");
    const monthNames = ["SAUS", "VAS", "KOV", "BAL", "GEG", "BIR", "LIE", "RGP", "RGS", "SPA", "LAP", "GRU"];
    const date: GameDate = { id: `game-${Date.now()}`, label: `${day} ${monthNames[Number(month) - 1]}`, day: new Date(`${newDate}T12:00:00`).toLocaleDateString("lt-LT", { weekday: "short" }).replace(".", "").toUpperCase(), date: `${day} ${monthNames[Number(month) - 1]}`, time: newTime, seatsLeft: 16 };
    setDates([date, ...dates]);
    setNewDate("");
    setNewTime("19:00");
    setShowDateForm(false);
  }

  return <main className="app-background"><header className="topbar"><div className="brand"><span className="brand-mark">A</span><span>Auksinis Protas / Admin</span></div><div className="header-actions"><span className="mono">LAIMA</span><button className="ghost-btn" onClick={onLogout}>Atsijungti</button></div></header><section className="admin-page"><div className="dashboard-header"><div><span className="mono eyebrow">Valdymo centras</span><h1>Visa salė vienoje vietoje.</h1></div><button className="primary-btn" onClick={() => setShowDateForm(!showDateForm)}>+ Nauja žaidimo data</button></div>{showDateForm && <form className="panel date-form" onSubmit={addGameDate}><label className="field">Data<input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} required /></label><label className="field">Pradžios laikas<input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} required /></label><button className="primary-btn" type="submit">Išsaugoti laiką</button></form>}<div className="admin-date-strip">{dates.map((date, index) => <div className={`admin-date ${index === 0 ? "active" : ""}`} key={date.id}><span className="mono">{date.day}</span><strong>{date.date}</strong><span>{date.time} / {date.seatsLeft} laisvos</span></div>)}</div><div className="admin-grid"><div className="metric"><span>AKTYVI DATA</span><strong>{activeDate.date}</strong></div><div className="metric"><span>REZERVACIJOS</span><strong>09 / 16</strong></div><div className="metric"><span>PRISIJUNGĘ DABAR</span><strong>{participantActivity.filter((participant) => participant.status === "Prisijungęs").length}</strong></div></div><div className="panel room-panel"><div className="panel-heading"><div><h2>Dalyvių prisijungimai</h2><p>Visi dalyviai, prisijungimo ir atsijungimo laikai.</p></div><span className="mono capacity">{participantActivity.length} DALYVIAI</span></div><table className="admin-table"><thead><tr><th>Dalyvis</th><th>Būsena</th><th>Prisijungė</th><th>Atsijungė</th></tr></thead><tbody>{participantActivity.map((participant) => <tr key={participant.id}><td><strong>{participant.name}</strong></td><td><span className={`status ${participant.status === "Atsijungęs" ? "cancelled" : ""}`}>{participant.status}</span></td><td className="mono">{participant.login}</td><td className="mono">{participant.logout}</td></tr>)}</tbody></table></div><div className="panel room-panel"><div className="panel-heading"><div><h2>Veiksmų istorija</h2><p>Visos rezervacijos ir atšaukimai su serverio laiku.</p></div><span className="mono capacity">AUDIT LOG</span></div><table className="admin-table"><thead><tr><th>Veiksmas</th><th>Dalyvis</th><th>Vieta</th><th>Žaidimas</th><th>Tikslus laikas</th><th></th></tr></thead><tbody>{reservationEvents.map((event) => <tr key={event.id}><td><span className={`status ${event.action === "Atšaukimas" ? "cancelled" : ""}`}>{event.action}</span></td><td><strong>{event.user}</strong></td><td>{event.seat}</td><td>{event.date}</td><td className="mono">{event.time}</td><td><button className="danger-btn">Atmesti</button></td></tr>)}</tbody></table></div></section></main>;
}