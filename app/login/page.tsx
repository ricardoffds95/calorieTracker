import { LoginForm } from "@/components/auth/login-form";

const NOTICES: Record<string, string> = {
  confirmado: "Email confirmado. Já podes entrar com o teu email e a tua password.",
  link: "Este link já não é válido (expirou ou já foi usado). Entra com o teu email e password; se ainda não confirmaste, cria a conta outra vez.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key = params.confirmado ? "confirmado" : params.link ? "link" : null;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <LoginForm initialInfo={key ? NOTICES[key] : null} />
    </main>
  );
}
