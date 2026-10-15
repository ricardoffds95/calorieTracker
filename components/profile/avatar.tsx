import { User } from "lucide-react";
import { findAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/** The picture of the account in a circle: a photo, or a neutral person when none was chosen. */
export function Avatar({ id, className }: { id: string | null | undefined; className?: string }) {
  const avatar = findAvatar(id);
  const circle = "flex shrink-0 items-center justify-center overflow-hidden rounded-full";
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element -- a 256 px file served as it is
    return <img src={avatar.src} alt="" aria-hidden className={cn(circle, "bg-black object-cover", className)} />;
  }
  return (
    <span aria-hidden className={cn(circle, "bg-muted text-muted-foreground", className)}>
      <User className="size-1/2" />
    </span>
  );
}
