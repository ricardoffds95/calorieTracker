/**
 * Every line of the day (a meal's heading, a food, a composed meal and its items) uses the same three columns:
 * the main part (name + calories), an edit slot and a remove slot. The calories sit at the right end of the main
 * part in a fixed width, so they line up in every row whatever the length of the name or the buttons of the row.
 */
export const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem] items-center";
export const KCAL = "w-20 shrink-0 text-right text-sm tabular-nums";
/** Where the name starts: after the slot of the expand arrow (empty in rows that have none). */
export const ARROW_SLOT = "size-4 shrink-0";
