import { Suspense } from "react";
import { LogScreen } from "@/components/log/log-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

export default async function LogPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null; // the proxy redirects anonymous users to /login

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-label="A carregar" />}>
      <LogScreen userId={userId} />
    </Suspense>
  );
}
