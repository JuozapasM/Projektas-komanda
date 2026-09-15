export type SeatStatus = "free" | "occupied" | "mine";

export type Seat = { id: string; tableNumber: number; seatNumber: number; occupant?: string; status: SeatStatus };
export type GameDate = { id: string; label: string; day: string; date: string; time: string; seatsLeft: number };
export type ReservationEvent = {
  id: string;
  action: "Rezervacija" | "Atšaukimas" | "Atmesta";
  user: string;
  seat: string;
  date: string;
  time: string;
  reservationId?: string;
  rejectable?: boolean;
};
export type ParticipantActivity = { id: string; name: string; login: string; logout: string; status: "Prisijungęs" | "Atsijungęs" };
export type WinnerTeam = { place: 1 | 2 | 3; players: string[]; points: number; gameDate: string };
export type AllTimeWinner = { name: string; points: number; gamesPlayed: number };