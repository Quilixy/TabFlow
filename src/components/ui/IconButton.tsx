import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ekran okuyucu etiketi ve tooltip. Zorunlu: ikon tek başına anlam taşımaz. */
  label: string;
  /** Ek ipucu: tooltip'te etiketin altında gösterilir. */
  title?: string;
}

export function IconButton({
  label,
  title,
  type = 'button',
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ? `${label}\n${title}` : label}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
