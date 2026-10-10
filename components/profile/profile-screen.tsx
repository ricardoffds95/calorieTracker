"use client";

import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileSummary } from "@/components/profile-summary";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/queries/profile";

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
      {data && <ProfileForm profile={data} />}
    </div>
  );
}
