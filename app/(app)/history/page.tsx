import { Suspense } from "react";
import { HistoryScreen } from "@/components/history/history-screen";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null; // the proxy redirects anonymous users to /login

  return (
    <>
      <PageHeader title="History" />
      <Suspense fallback={<Skeleton className="h-96 w-full" aria-label="Loading" />}>
        <HistoryScreen userId={userId} />
      </Suspense>
    </>
  );
}
