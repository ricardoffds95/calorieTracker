import * as React from "react"
import { cn } from "@/lib/utils"

/** A long list that scrolls inside itself (thin visible scrollbar) instead of stretching the page. */
function ScrollList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-list"
      role="region"
      // focusable so the keyboard can scroll it
      tabIndex={0}
      className={cn("max-h-[55dvh] overflow-y-auto overscroll-contain rounded-md pr-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]", className)}
      {...props}
    />
  )
}

export { ScrollList }
