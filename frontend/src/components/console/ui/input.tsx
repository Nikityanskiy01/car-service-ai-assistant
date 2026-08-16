import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function Input(
  { className, type, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

export { Input };
