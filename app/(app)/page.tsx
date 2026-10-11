import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayScreen } from "@/components/today/today-screen";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null; // the proxy redirects anonymous users to /login

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-label="Loading" />}>
      <TodayScreen userId={userId} />
    </Suspense>
  );
}
