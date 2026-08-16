import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border px-4 py-3 text-sm flex gap-3', {
  variants: {
    variant: {
      default: 'bg-card text-card-foreground border-border',
      destructive: 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-foreground border-[color-mix(in_oklab,var(--color-danger)_40%,var(--color-border))]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('font-medium tracking-tight', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
