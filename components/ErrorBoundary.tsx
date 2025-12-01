
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center animate-fadeIn">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">出错了</h1>
            <p className="text-slate-500 mb-6 max-w-md">
                应用程序遇到意外错误。这可能是由于数据格式不兼容或 AI 解析结果不完整引起的。
            </p>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-left w-full max-w-lg overflow-auto max-h-40 mb-6">
                <code className="text-xs text-red-800 break-all font-mono">
                    {this.state.error?.message}
                </code>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 transition-colors shadow-lg"
            >
                刷新页面重试
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}
