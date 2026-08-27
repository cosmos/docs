export const ThemeToggle = () => {
  const [mode, setMode] = useState('');

  useEffect(() => {
    // Mintlify applies the resolved theme as a class on <html>, which is true
    // regardless of which theme control version the theme ships.
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      setMode('dark');
      return;
    }
    if (root.classList.contains('light')) {
      setMode('light');
      return;
    }
    // Fall back to stored preference / OS preference
    const stored = localStorage.getItem('theme') || localStorage.getItem('isDarkMode');
    if (stored === 'dark' || stored === 'light') {
      setMode(stored);
    } else {
      setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }, []);

  // Delegating to Mintlify's own control keeps the choice in sync with the rest
  // of the site. Its markup has changed across releases, so try each known shape
  // before falling back to driving the theme ourselves.
  const waitForElement = (selector, timeout = 500) =>
    new Promise((resolve) => {
      const start = Date.now();
      const poll = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return resolve(null);
        setTimeout(poll, 20);
      };
      poll();
    });

  const clickMintlifyControl = async (newMode) => {
    // Current: a menu whose items only mount once the trigger is opened.
    const trigger = document.querySelector('[data-testid="theme-preference-menu-trigger"]');
    if (trigger) {
      trigger.click();
      const item = await waitForElement(`[data-testid="theme-preference-${newMode}"]`);
      if (item) {
        item.click();
        return true;
      }
      // Menu opened but the item never appeared: close it again.
      trigger.click();
    }

    // Older releases: a pair of always-present buttons.
    const btn = document.querySelector(`[data-testid="mode-switch-${newMode}"]`);
    if (btn) {
      btn.click();
      return true;
    }

    return false;
  };

  const handleSwitch = async (newMode) => {
    setMode(newMode);
    if (await clickMintlifyControl(newMode)) return;

    // Direct fallback: manage the theme class and stored preference ourselves.
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newMode);
    localStorage.setItem('theme', newMode);
    localStorage.setItem('isDarkMode', newMode);
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
