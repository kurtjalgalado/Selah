import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary flex items-center justify-center p-6">
          <div className="bg-elevated border border-themed rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-3xl text-accent">!</span>
            </div>
            <h2 className="text-xl font-serif font-bold text-textprimary">Something went wrong</h2>
            <p className="text-sm text-textmuted">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#/library';
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-accent text-onaccent rounded-xl text-sm font-bold hover:bg-accent/90 transition shadow-lg shadow-accent/20"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
