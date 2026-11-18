import AppRouter from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
