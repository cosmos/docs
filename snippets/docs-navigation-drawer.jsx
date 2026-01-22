export const DocsNavigationDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <>
      {/* Visit Docs Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="bg-white dark:bg-[#202020] text-black dark:text-white px-4 md:px-6 py-2.5 md:py-3 rounded-full text-sm md:text-md font-medium hover:bg-white/80 dark:hover:bg-[#303030] hover:[box-shadow:0_0_20px_rgba(255,255,255,0.8)] dark:hover:[box-shadow:0_0_20px_rgba(32,32,32,0.8)] transition-all duration-300 flex items-center gap-2 md:gap-3"
      >
        <span className="whitespace-nowrap">Visit the docs</span>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-black dark:fill-white shrink-0">
          <path d="M4.67999 8.91512L4.67999 4.45715L9.36087 4.45715V8.91513L4.67999 8.91512Z" fill="currentColor"/>
          <path d="M0 13.3743L6.13823e-07 8.91633L4.68087 8.91633L4.68087 13.3743L0 13.3743Z" fill="currentColor"/>
          <path d="M0 4.45798L6.13823e-07 0L4.68087 5.84593e-07L4.68087 4.45798L0 4.45798Z" fill="currentColor"/>
        </svg>
      </button>

      {/* Drawer */}
      {isVisible && (
        <>
          {/* Backdrop */}
          <div
            className="docs-drawer-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              opacity: isAnimating ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />

          {/* Drawer */}
          <div
            className="docs-drawer bg-white dark:bg-[#1a1a1a] text-black dark:text-white"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '100%',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              transform: isAnimating ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* Header */}
            <div
              className="border-b border-black/10 dark:border-white/10"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 36px',
                opacity: isAnimating ? 1 : 0,
                transition: 'opacity 0.3s ease-out 0.05s'
              }}
            >
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src="/assets/brand/cosmos-dark.svg"
                  alt="Cosmos"
                  className="h-6 block dark:hidden"
                />
                <img
                  src="/assets/cosmos.svg"
                  alt="Cosmos"
                  className="h-6 hidden dark:block"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Contact Us Button */}
                <button
                  className="bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/90"
                  style={{
                    border: 'none',
                    borderRadius: '24px',
                    padding: '10px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Contact Us
                  <span style={{ fontSize: '12px' }}>↗</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-black dark:text-white hover:opacity-70"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'opacity 0.2s'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Navigation Links */}
            <nav style={{ flex: 1, padding: '48px 36px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{
                  marginBottom: '32px',
                  opacity: isAnimating ? 1 : 0,
                  transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.4s ease-out 0.1s, transform 0.4s ease-out 0.1s'
                }}>
                  <a
                    href="/sdk"
                    className="text-black dark:text-white hover:opacity-70"
                    style={{
                      textDecoration: 'none',
                      fontSize: '48px',
                      fontWeight: '300',
                      display: 'block',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Cosmos SDK
                  </a>
                </li>
                <li style={{
                  marginBottom: '32px',
                  opacity: isAnimating ? 1 : 0,
                  transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.4s ease-out 0.2s, transform 0.4s ease-out 0.2s'
                }}>
                  <a
                    href="/evm"
                    className="text-black dark:text-white hover:opacity-70"
                    style={{
                      textDecoration: 'none',
                      fontSize: '48px',
                      fontWeight: '300',
                      display: 'block',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Cosmos EVM
                  </a>
                </li>
                <li style={{
                  marginBottom: '32px',
                  opacity: isAnimating ? 1 : 0,
                  transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.4s ease-out 0.3s, transform 0.4s ease-out 0.3s'
                }}>
                  <a
                    href="/ibc"
                    className="text-black dark:text-white hover:opacity-70"
                    style={{
                      textDecoration: 'none',
                      fontSize: '48px',
                      fontWeight: '300',
                      display: 'block',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    IBC
                  </a>
                </li>
                <li style={{
                  marginBottom: '32px',
                  opacity: isAnimating ? 1 : 0,
                  transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'opacity 0.4s ease-out 0.4s, transform 0.4s ease-out 0.4s'
                }}>
                  <a
                    href="/enterprise/overview"
                    className="text-black dark:text-white hover:opacity-70"
                    style={{
                      textDecoration: 'none',
                      fontSize: '48px',
                      fontWeight: '300',
                      display: 'block',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Cosmos Enterprise
                  </a>
                </li>
              </ul>
            </nav>

            {/* Footer Links */}
            <div
              className="border-t border-black/10 dark:border-white/10"
              style={{
                padding: '36px',
                display: 'flex',
                gap: '32px',
                flexWrap: 'wrap',
                opacity: isAnimating ? 1 : 0,
                transition: 'opacity 0.4s ease-out 0.5s'
              }}
            >
              <a
                href="https://cosmoslabs.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black dark:text-white hover:opacity-70"
                style={{
                  textDecoration: 'none',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s'
                }}
              >
                Cosmos Labs
                <span style={{ fontSize: '12px' }}>↗</span>
              </a>
              <a
                href="https://interchain.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black dark:text-white hover:opacity-70"
                style={{
                  textDecoration: 'none',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s'
                }}
              >
                Interchain Foundation
                <span style={{ fontSize: '12px' }}>↗</span>
              </a>
            </div>
          </div>

          {/* Responsive Styles */}
          <style jsx>{`
            @media (min-width: 768px) {
              .docs-drawer {
                max-width: 480px !important;
              }
            }

            @media (max-width: 767px) {
              .docs-drawer nav ul li {
                margin-bottom: 24px !important;
              }
              .docs-drawer nav ul li a {
                font-size: 36px !important;
              }
              .docs-drawer {
                padding-bottom: env(safe-area-inset-bottom);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
};
