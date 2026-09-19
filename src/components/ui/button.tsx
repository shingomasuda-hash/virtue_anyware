import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'border-[var(--color-brand)] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] hover:border-[var(--color-brand-hover)]',
        secondary:
          'border-[var(--color-border-strong)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-neutral-soft)]',
        ghost: 'border-transparent bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-neutral-soft)]',
        danger: 'border-[var(--color-negative)] bg-[var(--color-negative)] text-white hover:opacity-90',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3',
        lg: 'h-9 px-4',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
