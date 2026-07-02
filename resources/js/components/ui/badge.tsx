import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"
import { STATUS_LABEL, type DeviceStatus } from "@/lib/status-colors"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Orion — device-state variants (tinted bg + status foreground)
        online: "border-transparent bg-status-online-bg text-status-online",
        offline:
          "border-transparent bg-status-offline-bg text-status-offline",
        warning:
          "border-transparent bg-status-warning-bg text-status-warning",
        danger: "border-transparent bg-status-danger-bg text-status-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Shared variant type so per-domain Record<Enum, Variant> maps (alert types,
// operational status, zone types, audit events, etc.) stay in sync with the
// variants actually defined in `badgeVariants` above.
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// StatusBadge — Orion convenience wrapper. Renders the leading status dot and
// the canonical label so device status looks identical everywhere it appears
// (map popups, sidebar list, tables).
//   <StatusBadge status="warning" />            -> • Warning
//   <StatusBadge status="online">Live</StatusBadge>
// -----------------------------------------------------------------------------
function StatusBadge({
  status,
  children,
  ...props
}: { status: DeviceStatus } & Omit<
  React.ComponentProps<typeof Badge>,
  "variant"
>) {
  return (
    <Badge variant={status} {...props}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children ?? STATUS_LABEL[status]}
    </Badge>
  )
}

export { Badge, StatusBadge, badgeVariants }
