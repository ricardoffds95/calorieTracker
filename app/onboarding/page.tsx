import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null; // the proxy redirects anonymous users to /login

  const params = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <OnboardingScreen userId={userId} fromProfile={params.from === "profile"} />
    </main>
  );
}
