import { useTheme } from '../context/useTheme';

export default function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={darkMode}
      onClick={toggleDarkMode}
      className="theme-toggle"
      aria-label={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={darkMode ? 'Giao diện tối' : 'Giao diện sáng'}
    >
      <span className="material-symbols-outlined theme-toggle__icon theme-toggle__icon--sun">light_mode</span>
      <span className="material-symbols-outlined theme-toggle__icon theme-toggle__icon--moon">dark_mode</span>
      <span className="theme-toggle__thumb" />
    </button>
  );
}
