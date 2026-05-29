/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isChunkError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Detect chunk loading errors
    const isChunkError = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message
    );

    return {
      hasError: true,
      isChunkError,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if ((import.meta as any).env?.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // TODO: Send to error tracking service (Sentry, etc)
    // if ((import.meta as any).env?.PROD) {
    //   Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    // }
  }

  handleReload = () => {
    // Clear any cached service worker data
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }

    // Clear cache storage
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Chunk error - show update prompt
      if (this.state.isChunkError) {
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
            <div className="mx-4 flex max-w-md flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
              {/* Icon */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10">
                <RefreshCcw className="h-8 w-8 text-orange-500" />
              </div>

              {/* Title */}
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-white">Nova versão disponível</h2>
                <p className="text-sm text-white/60">
                  Uma atualização do app está disponível. Recarregue a página para continuar.
                </p>
              </div>

              {/* Button */}
              <button
                onClick={this.handleReload}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 font-bold text-white transition-all hover:bg-orange-600 active:scale-95"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar agora
              </button>

              {/* Footer */}
              <p className="text-xs text-white/30">
                Isso geralmente acontece quando o app é atualizado enquanto você está usando.
              </p>
            </div>
          </div>
        );
      }

      // Generic error - show error message
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
          <div className="mx-4 flex max-w-md flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
            {/* Icon */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-white">Algo deu errado</h2>
              <p className="text-sm text-white/60">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
            </div>

            {/* Error details (dev only) */}
            {(import.meta as any).env?.DEV && this.state.error && (
              <div className="w-full rounded-xl bg-black/50 p-4 text-left">
                <p className="text-xs font-mono text-red-400">{this.state.error.message}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex w-full gap-3">
              <button
                onClick={this.handleReload}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 py-3 font-bold text-white transition-all hover:bg-white/20 active:scale-95"
              >
                <RefreshCcw className="h-4 w-4" />
                Recarregar
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 font-bold text-white transition-all hover:bg-orange-600 active:scale-95"
              >
                Ir para Home
              </button>
            </div>

            {/* Footer */}
            <p className="text-xs text-white/30">
              Se o problema persistir, limpe o cache do navegador.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
