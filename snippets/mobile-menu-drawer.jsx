export const MobileMenuDrawer = () => {
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
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="block lg:hidden text-gray-900 dark:text-white p-2 hover:opacity-70 transition-opacity bg-[#F1F1F1] dark:bg-[#1E1F20] rounded-full"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current">
          <path d="M3 12H21M3 6H21M3 18H21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Drawer */}
      {isVisible && (
        <>
          {/* Backdrop */}
          <div
            className="mobile-menu-backdrop"
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
            className="mobile-menu-drawer bg-white dark:bg-[#1a1a1a] text-black dark:text-white"
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
                <a
                  href="https://cosmos.network/contact"
                  target="_blank"
                  rel="noopener noreferrer"
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
                    textDecoration: 'none',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Contact Us
                  <span style={{ fontSize: '12px' }}>↗</span>
                </a>

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
                    href="/sdk/v0.53/learn"
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
                    href="/evm/next/documentation/overview"
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
                    href="/ibc/next/intro"
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
              .mobile-menu-drawer {
                max-width: 480px !important;
              }
            }

            @media (max-width: 767px) {
              .mobile-menu-drawer nav ul li {
                margin-bottom: 24px !important;
              }
              .mobile-menu-drawer nav ul li a {
                font-size: 36px !important;
              }
              .mobile-menu-drawer {
                padding-bottom: env(safe-area-inset-bottom);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
};
