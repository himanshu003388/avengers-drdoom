import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  silent?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Caught boundary error:', error, info);
    }
  }

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.silent) {
      return this.props.fallback ?? null;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#020503] px-6 text-center text-[#e9f2ec]">
        <p className="text-xs font-bold tracking-[0.28em] text-emerald-400 uppercase">
          Battleworld Telemetry Interrupted
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-wider text-white uppercase sm:text-3xl">
          Avengers: Doomsday
        </h1>
        <p className="mt-2 max-w-md text-sm text-emerald-100/70">
          A temporary rendering glitch occurred on this device. Reload to restore the full experience.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 min-h-[44px] rounded-full border border-emerald-400/50 bg-emerald-600/20 px-6 py-2.5 text-xs font-bold tracking-[0.2em] text-emerald-100 uppercase transition hover:border-emerald-300 hover:bg-emerald-500/30"
        >
          Reload Experience
        </button>
      </div>
    );
  }
}
