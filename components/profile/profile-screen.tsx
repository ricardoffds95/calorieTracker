"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileSummary } from "@/components/profile-summary";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

export function ProfileScreen({ userId }: { userId: string }) {
  const { data, isPending, isError } = useProfile(userId);

  return (
    <div className="flex flex-col gap-6">
      <ProfileSummary userId={userId} />
      {isPending && <Skeleton className="h-96 w-full" aria-label="A carregar" />}
      {isError && !data && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o perfil.
        </p>
      )}
      {data && (
        <Card data-testid="plan-card">
          <CardHeader>
            <CardTitle className="text-base">Plano nutricional</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {data.plan_summary ?? "Responde a algumas perguntas e a IA calcula as calorias e as macros de que precisas."}
            </p>
            <Link href="/onboarding?de=perfil" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              <Sparkles aria-hidden />
              {data.onboarding_done_at && data.sex ? "Refazer o meu plano" : "Calcular o meu plano"}
            </Link>
          </CardContent>
        </Card>
      )}
      {data && <ProfileForm profile={data} />}
    </div>
  );
}
