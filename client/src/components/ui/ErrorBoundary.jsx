import React, { Component } from 'react';
import { Button } from './Button';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({ errorInfo });
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            errorInfo: this.state.errorInfo,
            resetError: this.handleReset,
          });
        }
        return this.props.fallback;
      }

      const title = this.props.title || 'Something went wrong in this review panel';
      const description =
        this.props.description ||
        'An unexpected rendering error occurred while assembling the application review checkpoint. You can try reloading this section or restarting the wizard.';

      return (
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/95 border border-rose-500/40 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-fadeIn my-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-2xl shadow-lg shadow-rose-500/10">
            ⚠️
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Technical error display (collapsible or snippet) */}
          {this.state.error && (
            <div className="max-w-2xl mx-auto text-left bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-mono font-bold text-rose-400 truncate">
                {this.state.error.toString()}
              </p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] font-mono text-slate-500 overflow-x-auto max-h-32 p-2 bg-slate-900/60 rounded-xl">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}

          {/* Action recovery buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={this.handleReset}
              className="border-slate-700 hover:border-slate-600 text-white font-semibold"
            >
              ↻ Try Again
            </Button>

            {typeof this.props.onReset === 'function' && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={this.props.onReset}
              >
                ← Back to Pipeline
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
