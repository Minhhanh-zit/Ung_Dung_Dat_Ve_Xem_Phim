import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

/** Bắt lỗi render không mong muốn để người dùng không bị màn hình trắng. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi giao diện:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="stitch-page grid place-items-center min-h-screen">
        <div className="cc-empty" style={{ maxWidth: 520 }}>
          <span className="cc-empty__icon"><span className="material-symbols-outlined">error</span></span>
          <h1 className="text-2xl font-extrabold">Có lỗi xảy ra</h1>
          <p className="stitch-muted">Trang gặp sự cố ngoài ý muốn. Bạn thử tải lại trang nhé.</p>
          <button type="button" className="stitch-btn stitch-btn-primary mt-4" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </section>
    );
  }
}
