import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SavedScreen } from "@/components/saved/saved-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null; // the proxy redirects anonymous users to /login

  return (
    <>
      <PageHeader title="Saved" />
      <Suspense fallback={<Skeleton className="h-96 w-full" aria-label="Loading" />}>
        <SavedScreen userId={userId} />
      </Suspense>
    </>
  );
}
