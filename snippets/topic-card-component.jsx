'use client'

export const TopicCard = ({ title, description, links = [], color = '#cccccc', titleHref = null, linkLabel = null, isMobile = false, isOpen = false, onToggle = () => {} }) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isLight, setIsLight] = React.useState(false)

  React.useEffect(() => {
    const checkTheme = () => {
      // Check multiple sources for theme
      const customContent = document.getElementById('custom-index-content')
      const htmlElement = document.documentElement

      let theme = null

      if (customContent) {
        theme = customContent.getAttribute('data-theme')
      }

      if (!theme && htmlElement) {
        theme = htmlElement.getAttribute('data-theme')
      }

      if (!theme && htmlElement) {
        theme = htmlElement.classList.contains('dark') ? 'dark' : 'light'
      }

      setIsLight(theme === 'light')
    }

    // Initial check with delay to ensure DOM is ready
    setTimeout(checkTheme, 0)
    setTimeout(checkTheme, 100)
    setTimeout(checkTheme, 500)

    const observer = new MutationObserver(checkTheme)

    // Observe both custom-index-content and html element
    const customContent = document.getElementById('custom-index-content')
    const htmlElement = document.documentElement

    if (customContent) {
      observer.observe(customContent, {
        attributes: true,
        attributeFilter: ['data-theme']
      })
    }

    if (htmlElement) {
      observer.observe(htmlElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class']
      })
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="topic-card"
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      style={{
        background: isMobile && isOpen
          ? (isLight
            ? 'linear-gradient(135deg, #F0F0F0 0%, #E0E0E0 100%)'
            : 'linear-gradient(135deg, #1a1a1a 0%, #0E0E0E 100%)')
          : (isLight
            ? 'linear-gradient(135deg, #E8E8E8 0%, #D5D5D5 100%)'
            : 'linear-gradient(135deg, #0E0E0E 0%, #1a1a1a 100%)'),
        border: isMobile
          ? `1px solid ${isOpen ? color : (isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(204, 204, 204, 0.15)')}`
          : `1px solid ${isHovered ? color : (isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(204, 204, 204, 0.2)')}`,
        borderRadius: isMobile ? '0' : '4px',
        padding: isMobile ? (isOpen ? '18px 20px 20px' : '14px 18px') : '28px',
        height: isMobile ? 'auto' : '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered && !isMobile ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isMobile
          ? (isOpen
            ? (isLight
              ? `0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px ${color}20`
              : `0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px ${color}20`)
            : (isLight
              ? '0 2px 8px rgba(0, 0, 0, 0.08)'
              : '0 2px 8px rgba(0, 0, 0, 0.2)'))
          : (isHovered
            ? (isLight
              ? `0 12px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px ${color}`
              : `0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px ${color}`)
            : (isLight
              ? '0 4px 12px rgba(0, 0, 0, 0.1)'
              : '0 4px 12px rgba(0, 0, 0, 0.3)')),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated gradient overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${color}, ${color}88, ${color})`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: !isMobile || isOpen ? '12px' : '0',
        }}
      >
        {titleHref && !isMobile ? (
          <a
            href={titleHref}
            {...(titleHref.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
            style={{
              textDecoration: 'none',
              flex: 1,
            }}
          >
            <h3
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: isLight ? '#1A1A1A' : '#F1F1F1',
                paddingBottom: '16px',
                borderBottom: `2px solid ${color}40`,
                display: 'flex',
                alignItems: 'center',
                margin: 0,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isLight ? '#1A1A1A' : '#F1F1F1'
              }}
            >
              {title}
            </h3>
          </a>
        ) : (
          <h3
            onClick={isMobile ? onToggle : undefined}
            style={{
              fontSize: isMobile ? '15px' : '22px',
              fontWeight: isMobile ? '600' : '700',
              color: isLight ? '#1A1A1A' : '#F1F1F1',
              paddingBottom: !isMobile || isOpen ? (isMobile ? '12px' : '16px') : '0',
              borderBottom: !isMobile || isOpen ? `${isMobile ? '1px' : '2px'} solid ${color}${isMobile ? '50' : '40'}` : 'none',
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              margin: 0,
              marginBottom: isMobile && isOpen ? '8px' : '0',
              cursor: isMobile ? 'pointer' : 'default',
              userSelect: isMobile ? 'none' : 'auto',
            }}
          >
            {title}
          </h3>
        )}
        {isMobile && (
          <div
            onClick={onToggle}
            style={{
              fontSize: '18px',
              fontWeight: '300',
              color: color,
              transition: 'transform 0.25s ease',
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              cursor: 'pointer',
              padding: '4px 8px',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
            }}
          >
            ›
          </div>
        )}
      </div>

      {isMobile && isOpen && titleHref && linkLabel && (
        <a
          href={titleHref}
          {...(titleHref.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
          style={{
            display: 'inline-block',
            marginTop: '4px',
            marginBottom: '8px',
            padding: '5px 10px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: '600',
            color: isLight ? '#1A1A1A' : '#F1F1F1',
            background: `${color}20`,
            border: `1px solid ${color}40`,
            borderRadius: '4px',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            width: 'fit-content',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${color}30`
            e.currentTarget.style.borderColor = color
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${color}20`
            e.currentTarget.style.borderColor = `${color}40`
          }}
        >
          {linkLabel}
        </a>
      )}

      <div
        style={{
          maxHeight: isMobile && !isOpen ? '0' : '2000px',
          opacity: isMobile && !isOpen ? '0' : '1',
          overflow: 'hidden',
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {description && (
          <p
            style={{
              fontSize: isMobile ? '13px' : '14px',
              color: isLight ? '#4A4A4A' : '#aaaaaa',
              lineHeight: '1.6',
              marginBottom: isMobile ? '16px' : '24px',
              marginTop: '0',
              flex: '0 0 auto',
            }}
          >
            {description}
          </p>
        )}

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flex: '1',
          }}
        >
        {links.map((link, index) => {
          const isExternal = link.href.startsWith('http')
          return (
            <li key={index}>
              <a
                href={link.href}
                className="topic-link"
                {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
                style={{
                  color: isLight ? '#4A4A4A' : '#cccccc',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${color}15`
                  e.currentTarget.style.color = color
                  e.currentTarget.style.paddingLeft = '16px'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = isLight ? '#4A4A4A' : '#cccccc'
                  e.currentTarget.style.paddingLeft = '12px'
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    opacity: 0.7,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  →
                </span>
                <span>{link.text}</span>
              </a>
            </li>
          )
        })}
        </ul>
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: isHovered && !isMobile ? 0.5 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />
    </div>
  )
}

export const TopicCardGrid = ({ children, cols = 3 }) => {
  const [isMobile, setIsMobile] = React.useState(false)
  const [openCardIndex, setOpenCardIndex] = React.useState(null)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const childrenWithProps = React.Children.map(children, (child, index) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        isMobile,
        isOpen: openCardIndex === index,
        onToggle: () => setOpenCardIndex(openCardIndex === index ? null : index),
      })
    }
    return child
  })

  return (
    <div
      className="topic-card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr'
          : (cols ? `repeat(${cols}, 1fr)` : 'repeat(auto-fit, minmax(320px, 1fr))'),
        gap: isMobile ? '16px' : '28px',
        marginBottom: '40px',
        marginTop: '20px',
      }}
    >
      {childrenWithProps}
    </div>
  )
}
