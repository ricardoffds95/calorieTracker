import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snacks"]);

const nonNegative = z.coerce.number().finite().min(0);

const grams = z.coerce.number().finite().positive().max(100_000);

/**
 * One line of a meal, as stored in `items` (saved meals, diary meal entries). Meals are counted in
 * portions: `quantity_g` is null for a meal defined by its totals per portion (e.g. "Bifana").
 */
export const foodItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity_g: grams.nullable(),
  calories: nonNegative,
  protein_g: nonNegative,
  carbs_g: nonNegative,
  fat_g: nonNegative,
});

export const foodItemsSchema = z.array(foodItemSchema).min(1).max(50);

/** AI items always come with estimated grams (used to rescale when the user edits them). */
export const aiItemSchema = foodItemSchema.extend({ quantity_g: grams });
export const aiResultSchema = z.array(aiItemSchema).min(1).max(30);

/** What the AI returns: one meal (e.g. "Frango com arroz") made of food lines. */
export const aiMealSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** "food": one product or ingredient; "meal": a dish or several foods. Older answers have none. */
  kind: z.enum(["food", "meal"]).optional(),
  items: aiResultSchema,
});

export const AI_MAX_TEXT_LENGTH = 1000;
/** Base64 characters (~4 MB of image data). The client resizes photos before sending. */
export const AI_MAX_IMAGE_BASE64_LENGTH = 5_600_000;

export const aiRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().trim().min(1, "Escreve o que comeste.").max(AI_MAX_TEXT_LENGTH, "Texto demasiado longo."),
  }),
  z.object({
    type: z.literal("image"),
    image: z
      .string()
      .min(1, "Imagem em falta.")
      .max(AI_MAX_IMAGE_BASE64_LENGTH, "Imagem demasiado grande.")
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Imagem inválida."),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  }),
]);

export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiFoodItem = z.infer<typeof aiItemSchema>;
/** The AI answer; a "food" always has exactly one item. */
export type AiMeal = Omit<z.infer<typeof aiMealSchema>, "kind"> & { kind: "food" | "meal" };
