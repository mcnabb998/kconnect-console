import React from 'react';

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: React.ReactNode;
}

/**
 * Button component that shows a loading spinner and custom text when processing
 *
 * @example
 * <LoadingButton
 *   loading={isSaving}
 *   loadingText="Saving..."
 *   onClick={handleSave}
 * >
 *   Save Changes
 * </LoadingButton>
 */
export function LoadingButton({
  loading = false,
  loadingText,
  variant = 'primary',
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

  const variantClasses = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-500',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500',
    ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-500',
  };

  return (
    <button
      type="button"
      disabled={loading || disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}
