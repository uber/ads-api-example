'use client';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title,
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
    >
      <h3 className="text-lg font-medium text-red-900">{title}</h3>
      <p className="mt-2 text-sm text-red-800 break-words">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
