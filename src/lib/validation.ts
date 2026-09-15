import { z } from "zod";

export const credentialsSchema = z.object({
  name: z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(40)),
  password: z.string().min(4).refine((value) => new TextEncoder().encode(value).length <= 72),
});
export const uuidSchema = z.string().uuid();
export const winnersSchema = z.array(z.object({
  place: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  players: z.array(z.string().trim().max(40)).max(4),
  points: z.number().int().min(0).max(1000000),
  gameDate: z.string().trim().min(1).max(80),
})).length(3).refine((items) => new Set(items.map((item) => item.place)).size === 3)
  .refine((items) => new Set(items.map((item) => item.gameDate)).size === 1);
