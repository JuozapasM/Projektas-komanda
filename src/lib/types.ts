export type SeatStatus = "free" | "occupied" | "mine";

export type Seat = { id: string; tableNumber: number; seatNumber: number; occupant?: string; status: SeatStatus };
export type GameDate = { id: string; label: string; day: string; date: string; time: string; seatsLeft: number };
export type ReservationEvent = { id: string; action: "Rezervacija" | "Atšaukimas"; user: string; seat: string; date: string; time: string };
export type ParticipantActivity = { id: string; name: string; login: string; logout: string; status: "Prisijungęs" | "Atsijungęs" };