import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('app_error_boundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fm-page" role="alert">
        <article className="fm-legal" style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem' }}>
          <header className="fm-page-head">
            <h1>Интерфейс не смог отрисоваться</h1>
            <p>Страница упала с ошибкой. Данные на сервере не затронуты — обновите экран или вернитесь на главную.</p>
          </header>
          <div className="fm-not-found__actions">
            <button type="button" className="fm-btn fm-btn-primary" onClick={() => window.location.reload()}>
              Обновить страницу
            </button>
            <a className="fm-btn fm-btn-outline" href="/">
              На главную
            </a>
          </div>
        </article>
      </main>
    );
  }
}
