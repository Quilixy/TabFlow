import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gray-900 text-white hover:bg-gray-800 shadow-none',
  secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-none shadow-none',
  soft: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-none',
  danger: 'bg-red-600 text-white hover:opacity-90 shadow-none',
  ghost: 'text-gray-600 hover:bg-gray-100',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-60 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {isLoading && (
        <span
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}