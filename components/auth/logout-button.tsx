"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { clearUserCache } from "@/lib/query/persister";

export function LogoutButton({ userId }: { userId: string }) {
  async function onClick() {
    await clearUserCache(userId);
    await createClient().auth.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose
    window.location.assign("/login");
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={onClick}>
      Log out
    </Button>
  );
}
