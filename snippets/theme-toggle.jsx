export const ThemeToggle = () => {
  const [mode, setMode] = useState('');

  useEffect(() => {
    // Try to read active mode from Mintlify's hidden buttons
    for (const m of ['light', 'dark']) {
      const btn = document.querySelector(`[data-testid="mode-switch-${m}"]`);
      if (btn && btn.classList.contains('bg-gray-200')) {
        setMode(m);
        return;
      }
    }
    // Fall back to localStorage / OS preference
    const stored = localStorage.getItem('isDarkMode');
    if (stored === 'dark' || stored === 'light') {
      setMode(stored);
    } else {
      setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }, []);

  const handleSwitch = (newMode) => {
    // Delegate to Mintlify's hidden button if present
    const mintBtn = document.querySelector(`[data-testid="mode-switch-${newMode}"]`);
    if (mintBtn) {
      mintBtn.click();
    } else {
      // Direct fallback: manage dark class and localStorage ourselves
      const root = document.documentElement;
      if (newMode === 'dark') {
        root.classList.add('dark');
        localStorage.setItem('isDarkMode', 'dark');
      } else if (newMode === 'light') {
        root.classList.remove('dark');
        localStorage.setItem('isDarkMode', 'light');
      }
    }
    setMode(newMode);
  };

  const base = "p-1.5 rounded-lg";
  const active = `${base} bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400`;
  const inactive = `${base} text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400`;

  return (
    <div className="flex items-center gap-2">
      {/* Light */}
      <button
        aria-label="Switch to light theme"
        onClick={() => handleSwitch('light')}
        className={mode === 'light' ? active : inactive}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" className="size-4">
          <g clipPath="url(#clip0_theme_light)">
            <path d="M8 1.11133V2.00022" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.8711 3.12891L12.2427 3.75735" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.8889 8H14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.8711 12.8711L12.2427 12.2427" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 14.8889V14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.12891 12.8711L3.75735 12.2427" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1.11133 8H2.00022" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.12891 3.12891L3.75735 3.75735" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.00043 11.7782C10.0868 11.7782 11.7782 10.0868 11.7782 8.00043C11.7782 5.91402 10.0868 4.22266 8.00043 4.22266C5.91402 4.22266 4.22266 5.91402 4.22266 8.00043C4.22266 10.0868 5.91402 11.7782 8.00043 11.7782Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
          <defs><clipPath id="clip0_theme_light"><rect width="16" height="16" fill="white"/></clipPath></defs>
        </svg>
      </button>

      {/* Dark */}
      <button
        aria-label="Switch to dark theme"
        onClick={() => handleSwitch('dark')}
        className={mode === 'dark' ? active : inactive}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon size-4">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      </button>
    </div>
  );
}
