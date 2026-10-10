import { toast } from "sonner";

/** supabase-js reports a failed fetch as an error whose message mentions fetch/network. */
export function isNetworkError(error: { message?: string } | null | undefined): boolean {
  return /failed to fetch|fetch failed|network|load failed/i.test(error?.message ?? "");
}

export function toastSaveError(error: { message?: string } | null | undefined) {
  toast.error(
    isNetworkError(error) ? "Sem ligação. As alterações não foram guardadas." : "Não foi possível guardar. Tenta novamente.",
  );
}
