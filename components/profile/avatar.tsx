import { Apple, Dumbbell, Flame, User, type LucideIcon } from "lucide-react";
import { findAvatar } from "@/lib/avatars";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { dumbbell: Dumbbell, apple: Apple, flame: Flame };

/** The picture of the account in a circle: a photo, a drawn icon, or a neutral person when none was chosen. */
export function Avatar({ id, className }: { id: string | null | undefined; className?: string }) {
  const avatar = findAvatar(id);
  const circle = "flex shrink-0 items-center justify-center overflow-hidden rounded-full";
  if (avatar?.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- a 256 px file served as it is
    return <img src={avatar.src} alt="" aria-hidden className={cn(circle, "bg-black object-cover", className)} />;
  }
  if (avatar?.kind === "icon") {
    const Icon = ICONS[avatar.icon]!;
    return (
      <span aria-hidden className={cn(circle, "bg-red-600 text-white ring-2 ring-black", className)}>
        <Icon className="size-1/2" />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(circle, "bg-muted text-muted-foreground", className)}>
      <User className="size-1/2" />
    </span>
  );
}
