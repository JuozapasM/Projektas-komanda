export const TABLE_COUNT = 7;
export const SEATS_PER_TABLE = 4;
export const GAME_CAPACITY = TABLE_COUNT * SEATS_PER_TABLE;
export const TABLE_NUMBERS = Array.from({ length: TABLE_COUNT }, (_, index) => index + 1);
