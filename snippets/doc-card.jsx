'use client'

export const DocCard = ({ title, description, docsLink, githubLink, isHighlighted }) => {
  return (
      <div
        className={`
        rounded-[24px] md:rounded-[40px] p-6 md:p-10 lg:p-14
        flex flex-col justify-between h-full
        ${isHighlighted ? 'highlighted-card-bg' : 'bg-white dark:bg-black'}
        ${!isHighlighted && 'hover:bg-[#F5F5F5] dark:hover:bg-[#CFDADC]'}
        border border-black/10
        dark:border-white/10
        transition-all duration-300
        group
      `}
      >
      <div className="relative z-10 flex flex-col gap-3 md:gap-4 mb-8 md:mb-12">
        <h3 className={`
          ${isHighlighted ? 'text-black' : 'text-gray-900 dark:text-white'}
          ${!isHighlighted && 'group-hover:text-black'}
          text-xl md:text-2xl leading-[1.5] tracking-[0.24px]
          transition-colors duration-300
        `}>
          {title}
        </h3>
        <p className={`
          ${isHighlighted ? 'text-black' : 'text-black/50 dark:text-white/50'}
          ${!isHighlighted && 'group-hover:text-black/60'}
          text-sm md:text-base leading-[1.6] tracking-[0.64px]
          transition-colors duration-300
        `}>
          {description}
        </p>
      </div>

      <div className="relative z-10 flex gap-3 md:gap-4 items-center flex-wrap">
        {docsLink && (
          <a
            href={docsLink}
            className="
              bg-[#323536]
              text-white px-4 py-2.5 md:py-3 rounded-full
              text-sm md:text-md
              flex items-center gap-2 md:gap-3
              hover:bg-[#404243]
              transition-all duration-300
            "
          >
            Read the docs
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-white shrink-0">
              <path d="M4.67999 8.91512L4.67999 4.45715L9.36087 4.45715V8.91513L4.67999 8.91512Z" fill="currentColor"/>
              <path d="M0 13.3743L6.13823e-07 8.91633L4.68087 8.91633L4.68087 13.3743L0 13.3743Z" fill="currentColor"/>
              <path d="M0 4.45798L6.13823e-07 0L4.68087 5.84593e-07L4.68087 4.45798L0 4.45798Z" fill="currentColor"/>
            </svg>
          </a>
        )}
        {githubLink && (
          <a
            href={githubLink}
            target="_blank"
            rel="noopener noreferrer"
            className="
              bg-[#323536]
              text-white px-4 py-2.5 md:py-3 rounded-full
              text-sm md:text-md
              flex items-center gap-2 md:gap-3
              hover:bg-[#404243]
              transition-all duration-300
            "
          >
            Github
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-white shrink-0">
              <path d="M4.67999 8.91512L4.67999 4.45715L9.36087 4.45715V8.91513L4.67999 8.91512Z" fill="currentColor"/>
              <path d="M0 13.3743L6.13823e-07 8.91633L4.68087 8.91633L4.68087 13.3743L0 13.3743Z" fill="currentColor"/>
              <path d="M0 4.45798L6.13823e-07 0L4.68087 5.84593e-07L4.68087 4.45798L0 4.45798Z" fill="currentColor"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

export const DocCardGrid = ({ children }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {children}
    </div>
  )
}
