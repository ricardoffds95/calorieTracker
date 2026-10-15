/** The pictures a user can pick for their account: photos (files in /public/avatars), in the order they are listed. */
export const AVATARS = [
  { id: "photo-1", src: "/avatars/photo-1.png", label: "Photo 1" },
  { id: "photo-2", src: "/avatars/photo-2.png", label: "Photo 2" },
  { id: "photo-3", src: "/avatars/photo-3.png", label: "Photo 3" },
  { id: "photo-4", src: "/avatars/photo-4.png", label: "Photo 4" },
  { id: "photo-5", src: "/avatars/photo-5.png", label: "Photo 5" },
  { id: "photo-6", src: "/avatars/photo-6.png", label: "Photo 6" },
  { id: "photo-7", src: "/avatars/photo-7.png", label: "Photo 7" },
  { id: "photo-8", src: "/avatars/photo-8.png", label: "Photo 8" },
  { id: "photo-9", src: "/avatars/photo-9.png", label: "Photo 9" },
] as const;

/** How many the picker shows before "Show more". */
export const AVATARS_SHOWN = 6;

export type Avatar = (typeof AVATARS)[number];
export type AvatarId = Avatar["id"];

/** The avatar for a stored id, or null (no choice yet, or an id this version does not know, such as the drawn icons of an older version). */
export function findAvatar(id: string | null | undefined): Avatar | null {
  return AVATARS.find((a) => a.id === id) ?? null;
}
