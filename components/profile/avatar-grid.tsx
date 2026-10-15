import { Avatar } from "@/components/profile/avatar";
import { AVATARS } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface AvatarGridProps {
  /** The chosen avatar id, or null when none was chosen yet. */
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Every picture the account can have, to pick one. */
export function AvatarGrid({ value, onChange, disabled = false }: AvatarGridProps) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-3 gap-4 py-2">
      {AVATARS.map((avatar) => {
        const selected = value === avatar.id;
        return (
          <button
            key={avatar.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={avatar.label}
            disabled={disabled}
            onClick={() => !selected && onChange(avatar.id)}
            className={cn("mx-auto rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "ring-2 ring-primary")}
          >
            <Avatar id={avatar.id} className="size-20" />
          </button>
        );
      })}
    </div>
  );
}
