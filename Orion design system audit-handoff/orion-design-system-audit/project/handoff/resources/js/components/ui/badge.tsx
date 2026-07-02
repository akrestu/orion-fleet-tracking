// resources/js/components/ui/badge.tsx
// shadcn/ui Badge + Orion device-state variants.
// If you already have this file, just merge the four lines marked
// "// Orion" into your existing badgeVariants, and copy the StatusBadge
// helper at the bottom. Everything else matches the stock shadcn Badge.

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { STATUS_LABEL, type DeviceStatus } from "@/lib/fleet";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        outline: "text-foreground border-border [a&]:hover:bg-muted",
        // Orion — device-state variants (tinted bg + status foreground)
        online: "border-transparent bg-status-online-bg text-status-online",
        offline: "border-transparent bg-status-offline-bg text-status-offline",
        warning: "border-transparent bg-status-warning-bg text-status-warning",
        danger: "border-transparent bg-status-danger-bg text-status-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// StatusBadge — Orion convenience wrapper. Renders the leading status dot and
// the canonical label so device status looks identical everywhere it appears.
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
  );
}

export { Badge, StatusBadge, badgeVariants };
