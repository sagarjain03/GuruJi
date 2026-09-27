import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 aria-invalid:outline-destructive motion-reduce:active:translate-y-0",
  {
    variants: {
      variant: {
        // Solid, with a hairline highlight on the top edge instead of a glow.
        default:
          'border border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.35)] hover:bg-primary/88',
        secondary:
          'border border-transparent bg-secondary text-secondary-foreground hover:border-foreground/15 hover:bg-accent',
        // Hairline that brightens on hover.
        outline:
          'border border-border bg-transparent hover:border-foreground/40 hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-none px-3 text-xs',
        default: 'h-9 px-4 py-2',
        lg: 'h-11 rounded-none px-6 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the single child element instead of a <button> — for links. */
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
