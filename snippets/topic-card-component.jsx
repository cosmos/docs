export const TopicCard = ({ title, description, links = [], color = '#cccccc' }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="topic-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(135deg, #0E0E0E 0%, #1a1a1a 100%)',
        border: `1px solid ${isHovered ? color : 'rgba(204, 204, 204, 0.2)'}`,
        borderRadius: '12px',
        padding: '28px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered
          ? `0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px ${color}`
          : '0 4px 12px rgba(0, 0, 0, 0.3)',
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

      <h3
        style={{
          fontSize: '22px',
          fontWeight: '700',
          color: '#F1F1F1',
          marginBottom: '12px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${color}40`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 12px ${color}`,
            display: 'inline-block',
          }}
        />
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: '14px',
            color: '#aaaaaa',
            lineHeight: '1.7',
            marginBottom: '24px',
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
        {links.map((link, index) => (
          <li key={index}>
            <a
              href={link.href}
              className="topic-link"
              style={{
                color: '#cccccc',
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
                e.currentTarget.style.color = '#cccccc'
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
        ))}
      </ul>

      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: isHovered ? 0.5 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />
    </div>
  )
}

export const TopicCardGrid = ({ children, cols = 3 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(320px, 1fr))`,
        gap: '28px',
        marginBottom: '40px',
        marginTop: '20px',
      }}
    >
      {children}
    </div>
  )
}
