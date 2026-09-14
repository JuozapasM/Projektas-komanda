import type { AllTimeWinner, GameDate, ParticipantActivity, ReservationEvent, Seat, WinnerTeam } from "./types";

export const gameDates: GameDate[] = [
  { id: "game-1", label: "Spalio 10", day: "PEN", date: "10 SPAL", time: "19:00", seatsLeft: 7 },
  { id: "game-2", label: "Spalio 17", day: "PEN", date: "17 SPAL", time: "19:00", seatsLeft: 16 },
  { id: "game-3", label: "Spalio 24", day: "PEN", date: "24 SPAL", time: "19:00", seatsLeft: 16 },
];

export function createSeats(): Seat[] {
  const occupied: Record<number, string> = { 2: "Mantas", 5: "Ieva", 8: "Tomas", 10: "Rūta", 13: "Darius", 15: "Gabija", 16: "Lukas" };
  return Array.from({ length: 16 }, (_, index) => {
    const seatNumber = index + 1;
    return { id: `seat-${seatNumber}`, tableNumber: Math.ceil(seatNumber / 4), seatNumber: ((seatNumber - 1) % 4) + 1, occupant: occupied[seatNumber], status: occupied[seatNumber] ? "occupied" : "free" };
  });
}

export const reservationEvents: ReservationEvent[] = [
  { id: "event-1", action: "Rezervacija", user: "Mantas", seat: "2 stalas / 2 vieta", date: "10 spalio", time: "2026-09-14 18:42" },
  { id: "event-2", action: "Rezervacija", user: "Ieva", seat: "2 stalas / 1 vieta", date: "10 spalio", time: "2026-09-14 18:37" },
  { id: "event-3", action: "Atšaukimas", user: "Karolis", seat: "1 stalas / 4 vieta", date: "10 spalio", time: "2026-09-14 17:12" },
  { id: "event-4", action: "Rezervacija", user: "Tomas", seat: "3 stalas / 4 vieta", date: "10 spalio", time: "2026-09-13 20:05" },
];

export const participantActivity: ParticipantActivity[] = [
  { id: "participant-1", name: "Mantas", login: "2026-09-14 18:42", logout: "Dar prisijungęs", status: "Prisijungęs" },
  { id: "participant-2", name: "Ieva", login: "2026-09-14 18:37", logout: "2026-09-14 19:04", status: "Atsijungęs" },
  { id: "participant-3", name: "Tomas", login: "2026-09-14 18:21", logout: "Dar prisijungęs", status: "Prisijungęs" },
  { id: "participant-4", name: "Rūta", login: "2026-09-14 17:58", logout: "2026-09-14 18:51", status: "Atsijungęs" },
  { id: "participant-5", name: "Darius", login: "2026-09-14 17:43", logout: "2026-09-14 18:32", status: "Atsijungęs" },
  { id: "participant-6", name: "Gabija", login: "2026-09-14 17:26", logout: "Dar prisijungęs", status: "Prisijungęs" },
  { id: "participant-7", name: "Lukas", login: "2026-09-14 17:12", logout: "2026-09-14 18:20", status: "Atsijungęs" },
];

export const lastGameWinners: WinnerTeam[] = [
  { place: 1, players: ["Mantas", "Ieva", "Tomas", "Rūta"], points: 42, gameDate: "10 spalio" },
  { place: 2, players: ["Darius", "Gabija", "Lukas"], points: 36, gameDate: "10 spalio" },
  { place: 3, players: ["Karolis", "Agnė", "Paulius", "Eglė"], points: 31, gameDate: "10 spalio" },
];

export const allTimeWinners: AllTimeWinner[] = [
  { name: "Mantas", points: 184, gamesPlayed: 8 },
  { name: "Ieva", points: 176, gamesPlayed: 8 },
  { name: "Tomas", points: 169, gamesPlayed: 7 },
];