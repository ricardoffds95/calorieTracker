/** The pictures a user can pick for their account: three photos (files in /public/avatars) and three drawn icons. */
export const AVATARS = [
  { id: "photo-1", kind: "image", src: "/avatars/photo-1.png", label: "Photo 1" },
  { id: "photo-2", kind: "image", src: "/avatars/photo-2.png", label: "Photo 2" },
  { id: "photo-3", kind: "image", src: "/avatars/photo-3.png", label: "Photo 3" },
  { id: "icon-dumbbell", kind: "icon", icon: "dumbbell", label: "Dumbbell" },
  { id: "icon-apple", kind: "icon", icon: "apple", label: "Apple" },
  { id: "icon-flame", kind: "icon", icon: "flame", label: "Flame" },
] as const;

export type Avatar = (typeof AVATARS)[number];
export type AvatarId = Avatar["id"];

/** The avatar for a stored id, or null (no choice yet, or an id this version does not know). */
export function findAvatar(id: string | null | undefined): Avatar | null {
  return AVATARS.find((a) => a.id === id) ?? null;
}
