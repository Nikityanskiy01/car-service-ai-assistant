import { StatusErrorPage } from './StatusErrorPage';

export function ForbiddenPage() {
  return <StatusErrorPage code={403} />;
}
