import { PageHeader } from "@/components/page-header";
import { TrainingScreen } from "@/components/training/training-screen";
import { createClient } from "@/lib/supabase/server";

export default async function TrainingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null; // the proxy redirects anonymous users to /login

  return (
    <>
      <PageHeader title="Training" />
      <TrainingScreen userId={userId} />
    </>
  );
}
