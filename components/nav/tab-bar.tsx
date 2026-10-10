"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, ChartColumn, House, User, type LucideIcon } from "lucide-react";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Hoje", icon: House },
  { href: "/guardados", label: "Guardados", icon: Bookmark },
  { href: "/historico", label: "Histórico", icon: ChartColumn },
  { href: "/perfil", label: "Perfil", icon: User },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TabBar() {
  const pathname = usePathname();
  const keyboardOpen = useKeyboardOpen();

  return (
    <nav
      aria-label="Navegação principal"
      // Hidden (not removed) while the keyboard is open: on iOS it would float in the middle of the screen.
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur",
        keyboardOpen && "hidden",
      )}
    >
      <ul className="mx-auto flex h-(--tab-bar-height) max-w-md items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
