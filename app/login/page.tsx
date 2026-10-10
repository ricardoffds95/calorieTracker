import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <LoginForm />
    </main>
  );
}
