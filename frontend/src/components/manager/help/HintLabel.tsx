import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../console/ui/tooltip';

export function HintTooltip({
  hint,
  side = 'bottom',
  children,
}: {
  hint?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
}) {
  if (!hint) return children;

  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent variant="hint" side={side} collisionPadding={8}>
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

export function HintLabel({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <HintTooltip hint={hint}>
      <button type="button" className="hint-term">
        {children}
      </button>
    </HintTooltip>
  );
}
