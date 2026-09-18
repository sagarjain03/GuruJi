import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Plain `clsx` would emit `px-2 px-4` and leave the winner to CSS source order,
 * which is not where the caller expects the decision to be made. `twMerge`
 * resolves the conflict in argument order, so a `className` prop can always
 * override a component's default.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
