import { XIcon } from './icons';
import { t } from '../../i18n';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      <p>{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('error.dismiss')}
          className="shrink-0 rounded p-0.5 text-red-600 hover:bg-red-100 hover:text-red-800"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}
