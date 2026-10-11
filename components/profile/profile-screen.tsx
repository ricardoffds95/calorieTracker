"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ManageProfile } from "@/components/profile/manage-profile";
import { UnsavedGuard } from "@/components/profile/unsaved-guard";
import { ProfileForm } from "@/components/profile/profile-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

export function ProfileScreen({ userId, email }: { userId: string; email: string }) {
  const { data, isPending, isError } = useProfile(userId);

  return (
    <UnsavedGuard>
    <div className="flex flex-col gap-6">
      {data && <ManageProfile profile={data} email={email} />}
      {isPending && <Skeleton className="h-96 w-full" aria-label="Loading" />}
      {isError && !data && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load profile
        </p>
      )}
      {data && <ProfileForm profile={data} />}
      {data && (
        <Card data-testid="plan-card">
          <CardHeader>
            <CardTitle className="text-base">Nutrition plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {data.plan_summary ?? "Set your goals with AI"}
            </p>
            <Link href="/onboarding?from=profile" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
              <Sparkles aria-hidden />
              {data.onboarding_done_at && data.sex ? "Redo my plan" : "Calculate my plan"}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
    </UnsavedGuard>
  );
}
