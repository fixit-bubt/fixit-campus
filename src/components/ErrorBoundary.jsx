import React from "react";

// App-wide error boundary: a render-time throw in any screen degrades to a
// recoverable message instead of white-screening the whole app.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a console trail for debugging; no external logging service wired up.
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-1 text-base text-ink-3">
            An unexpected error broke this page. Reloading usually fixes it.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-base font-bold text-white hover:bg-brand-700"
        >
          Reload
        </button>
      </div>
    );
  }
}
