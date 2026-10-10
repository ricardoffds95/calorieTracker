import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/page-header";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null; // the proxy redirects anonymous users to /login

  return (
    <>
      <PageHeader title="Perfil" />
      <div className="flex flex-col gap-8">
        <ProfileScreen userId={claims.sub} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p data-testid="user-email" className="text-sm text-muted-foreground">
              {claims.email}
            </p>
            <LogoutButton userId={claims.sub} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
