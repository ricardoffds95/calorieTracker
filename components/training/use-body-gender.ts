"use client";

import { useProfile } from "@/lib/queries/profile";

/** The body drawn in Training follows the sex in the profile (the male one when it is not given). */
export function useBodyGender(userId: string): "male" | "female" {
  return useProfile(userId).data?.sex === "female" ? "female" : "male";
}
