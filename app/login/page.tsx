import { LoginForm } from "@/components/auth/login-form";

const NOTICES: Record<string, string> = {
  confirmed: "Email confirmed",
  link: "Link expired or already used",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key = params.confirmed ? "confirmed" : params.link ? "link" : null;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <LoginForm initialInfo={key ? NOTICES[key] : null} />
    </main>
  );
}
