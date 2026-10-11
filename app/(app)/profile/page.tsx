import { ProfileScreen } from "@/components/profile/profile-screen";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null; // the proxy redirects anonymous users to /login

  return (
    <ProfileScreen userId={claims.sub} email={claims.email ?? ""} />
  );
}
