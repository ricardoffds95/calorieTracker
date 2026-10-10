import { describe, expect, it } from "vitest";
import { AI_MAX_IMAGE_BASE64_LENGTH, AI_MAX_TEXT_LENGTH, aiRequestSchema, aiResultSchema, foodItemSchema } from "./schemas";

const item = { name: "Frango", quantity_g: 150, calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 };

describe("foodItemSchema", () => {
  it("accepts a valid item and coerces numeric strings", () => {
    expect(foodItemSchema.parse({ ...item, calories: "165" }).calories).toBe(165);
  });
  it("rejects empty names, zero quantity and negative or non-finite values", () => {
    expect(foodItemSchema.safeParse({ ...item, name: "  " }).success).toBe(false);
    expect(foodItemSchema.safeParse({ ...item, quantity_g: 0 }).success).toBe(false);
    expect(foodItemSchema.safeParse({ ...item, calories: -1 }).success).toBe(false);
    expect(foodItemSchema.safeParse({ ...item, protein_g: Infinity }).success).toBe(false);
    expect(foodItemSchema.safeParse({ ...item, fat_g: "abc" }).success).toBe(false);
  });
});

describe("aiResultSchema", () => {
  it("requires between 1 and 30 items", () => {
    expect(aiResultSchema.safeParse([]).success).toBe(false);
    expect(aiResultSchema.safeParse([item]).success).toBe(true);
    expect(aiResultSchema.safeParse(Array(30).fill(item)).success).toBe(true);
    expect(aiResultSchema.safeParse(Array(31).fill(item)).success).toBe(false);
  });
  it("rejects non-arrays", () => {
    expect(aiResultSchema.safeParse(item).success).toBe(false);
  });
});

describe("aiRequestSchema", () => {
  it("accepts text and trims it", () => {
    const parsed = aiRequestSchema.parse({ type: "text", text: "  200g de arroz  " });
    expect(parsed).toEqual({ type: "text", text: "200g de arroz" });
  });
  it("rejects empty and too long text", () => {
    expect(aiRequestSchema.safeParse({ type: "text", text: "   " }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ type: "text", text: "a".repeat(AI_MAX_TEXT_LENGTH + 1) }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ type: "text", text: "a".repeat(AI_MAX_TEXT_LENGTH) }).success).toBe(true);
  });
  it("accepts a base64 image with an allowed mime type", () => {
    expect(aiRequestSchema.safeParse({ type: "image", image: "QUJD", mimeType: "image/jpeg" }).success).toBe(true);
  });
  it("rejects invalid base64, oversized images and other mime types", () => {
    expect(aiRequestSchema.safeParse({ type: "image", image: "not base64!", mimeType: "image/png" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ type: "image", image: "A".repeat(AI_MAX_IMAGE_BASE64_LENGTH + 1), mimeType: "image/png" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ type: "image", image: "QUJD", mimeType: "image/gif" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ type: "image", image: "", mimeType: "image/png" }).success).toBe(false);
  });
  it("rejects unknown types and missing fields", () => {
    expect(aiRequestSchema.safeParse({ type: "audio" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({}).success).toBe(false);
    expect(aiRequestSchema.safeParse({ type: "text" }).success).toBe(false);
  });
});
