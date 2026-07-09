import { Alert } from './Alert';
import { Button } from './Button';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert kind="error">
      {message}
      {onRetry ? (
        <div style={{ marginTop: '0.5rem' }}>
          <Button variant="ghost" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}
