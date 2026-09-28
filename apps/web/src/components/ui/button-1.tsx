'use client';

import type { HTMLAttributes } from 'react';
import './button-1.css';

interface GradientButtonProps extends HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  width?: string;
  height?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Renders a real link instead of a role="button" div, so navigation keeps
      link semantics (middle-click, open in new tab, announced as a link). It is
      a plain <a>, i.e. a full page load — see components/hard-link.tsx. */
  href?: string;
}

const GradientButton = ({
  children,
  width = '600px',
  height = '100px',
  className = '',
  onClick,
  disabled = false,
  href,
  ...props
}: GradientButtonProps) => {
  const commonGradientStyles = `
    relative rounded-[50px] cursor-pointer
    after:content-[""] after:block after:absolute after:bg-[var(--color-background)]
    after:inset-[3px] after:rounded-[47px] after:z-[1]
    after:transition-opacity after:duration-300 after:ease-linear
    flex items-center justify-center
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  const classes = `
    ${commonGradientStyles}
    rotatingGradient
    ${className}
  `;
  const style = {
    '--r': '0deg',
    minWidth: width,
    height: height,
  } as React.CSSProperties;
  const label = (
    <span className="relative z-10 text-[var(--color-text)] flex items-center justify-center label">
      {children}
    </span>
  );

  if (href && !disabled) {
    return (
      <div className="text-center">
        <a href={href} className={classes} style={style} onClick={onClick} {...props}>
          {label}
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={classes}
        style={style}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled}
        {...props}
      >
        {label}
      </div>
    </div>
  );
};

export default GradientButton;
