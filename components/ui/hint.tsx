import * as React from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

/** Says what is still missing (or why a button is not available), instead of leaving the button silently out or disabled. */
function Hint({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="hint" role="status" className={cn("flex items-start gap-2 rounded-md bg-muted p-3 text-sm", className)} {...props}>
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  )
}

export { Hint }
