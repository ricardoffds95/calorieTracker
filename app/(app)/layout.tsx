import type { ReactNode } from "react";
import { TabBar } from "@/components/nav/tab-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+1rem)]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
