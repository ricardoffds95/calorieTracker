"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Settings, UserRound, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Avatar } from "@/components/profile/avatar";
import { SettingsView } from "@/components/profile/settings-view";
import { useLeave } from "@/components/profile/unsaved-guard";
import { UserDataForm } from "@/components/profile/user-data-form";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AVATARS } from "@/lib/avatars";
import { useUpdateProfile, type Profile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

type View = "menu" | "icon" | "settings" | "data";
const TITLES: Record<View, string> = { menu: "Account", icon: "Change icon", settings: "Settings", data: "User data" };

/** The picture of the account in the corner of the Profile: tapping it opens Change icon, Settings, User data and Log out. */
export function AccountMenu({ profile, email }: { profile: Profile; email: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const leave = useLeave();

  const close = () => leave(() => (setOpen(false), setView("menu")));
  const back = () => leave(() => setView("menu"));

  return (
    <>
      <button type="button" aria-label="Account menu" onClick={() => setOpen(true)} className="size-11 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar id={profile.avatar} className="size-11" />
      </button>
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {view !== "menu" && (
                <Button type="button" variant="ghost" size="icon" className="-ml-2 size-9" aria-label="Back" onClick={back}>
                  <ChevronLeft aria-hidden />
                </Button>
              )}
              {TITLES[view]}
            </SheetTitle>
            <SheetDescription className="sr-only">{TITLES[view]}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            {view === "menu" && (
              <>
                <MenuRow label="Change icon" onClick={() => setView("icon")} lead={<Avatar id={profile.avatar} className="size-6" />} />
                <MenuRow label="Settings" icon={Settings} onClick={() => setView("settings")} />
                <MenuRow label="User data" icon={UserRound} onClick={() => setView("data")} />
                <LogoutButton userId={profile.user_id} />
              </>
            )}
            {view === "icon" && <IconPicker profile={profile} />}
            {view === "settings" && <SettingsView profile={profile} email={email} />}
            {view === "data" && <UserDataForm profile={profile} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MenuRow({ label, icon: Icon, lead, onClick }: { label: string; icon?: LucideIcon; lead?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-md border border-border px-4 text-left">
      {lead ?? (Icon ? <Icon aria-hidden className="size-5 text-muted-foreground" /> : <ImageIcon aria-hidden className="size-5" />)}
      <span className="flex-1">{label}</span>
      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
    </button>
  );
}

function IconPicker({ profile }: { profile: Profile }) {
  const update = useUpdateProfile(profile.user_id, "Icon saved");
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-3 gap-4 py-2">
      {AVATARS.map((avatar) => {
        const selected = profile.avatar === avatar.id;
        return (
          <button
            key={avatar.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={avatar.label}
            disabled={update.isPending}
            onClick={() => !selected && update.mutate({ avatar: avatar.id })}
            className={cn("mx-auto rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "ring-2 ring-primary")}
          >
            <Avatar id={avatar.id} className="size-20" />
          </button>
        );
      })}
    </div>
  );
}
