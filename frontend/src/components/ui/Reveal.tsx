import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type RevealTag = 'div' | 'section' | 'article' | 'li' | 'header';

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: RevealTag;
  delay?: number;
};

export function Reveal({ children, className = '', as = 'div', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      node.classList.add('is-revealed');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('is-revealed');
          observer.disconnect();
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay
    ? ({ ['--reveal-delay' as string]: `${delay}ms` } as CSSProperties)
    : undefined;

  return createElement(
    as,
    {
      ref,
      className: `reveal ${className}`.trim(),
      style,
    },
    children,
  );
}
