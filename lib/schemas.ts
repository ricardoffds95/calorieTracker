import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snacks"]);

const nonNegative = z.coerce.number().finite().min(0);

/** One food line, as stored in `items` (saved meals, diary meal entries). */
export const foodItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity_g: z.coerce.number().finite().positive().max(100_000),
  calories: nonNegative,
  protein_g: nonNegative,
  carbs_g: nonNegative,
  fat_g: nonNegative,
});

export const foodItemsSchema = z.array(foodItemSchema).min(1).max(50);

/** What the AI must return: a non-empty list of food lines. */
export const aiResultSchema = foodItemsSchema.max(30);

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
export type AiFoodItem = z.infer<typeof foodItemSchema>;
