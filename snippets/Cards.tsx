import React, { useState } from 'react'
import { ChevronRight, Code, Zap, Globe, Cpu, Network, Book, ArrowRight, ExternalLink } from 'lucide-react'

interface CardLink {
  title: string
  href: string
  description?: string
}

interface CardData {
  id: string
  title: string
  description: string
  longDescription: string
  icon: React.ElementType
  color: string
  href: string
  comingSoon?: boolean
  links: CardLink[]
  features: string[]
}

export const Cards = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const cards: CardData[] = [
    {
      id: 'cosmos-evm',
      title: 'Cosmos EVM',
      description: 'Deploy Ethereum smart contracts with Cosmos SDK integration',
      longDescription: 'Build EVM-compatible applications that leverage the power of Cosmos SDK modules, enabling seamless integration between Ethereum tooling and Cosmos ecosystem features.',
      icon: Code,
      color: 'from-[#6976af] to-[#8791bf]',
      href: '/docs/cosmos-evm',
      features: ['Smart Contract Deployment', 'Cosmos SDK Integration', 'EVM Compatibility', 'Cross-chain Features'],
      links: [
        { 
          title: 'Quick Start Guide', 
          href: '/docs/cosmos-evm/quickstart',
          description: 'Get started with Cosmos EVM in minutes'
        },
        { 
          title: 'Smart Contract Development', 
          href: '/docs/cosmos-evm/smart-contracts/overview',
          description: 'Learn to build and deploy smart contracts'
        }
      ]
    },
    {
      id: 'ibc',
      title: 'IBC Protocol',
      description: 'Connect to the Internet of Blockchains with cross-chain messaging',
      longDescription: 'Implement secure cross-chain communication using the Inter-Blockchain Communication protocol, enabling token transfers and custom application logic across connected chains.',
      icon: Network,
      color: 'from-[#545e8c] to-[#6976af]',
      href: '/docs/ibc',
      features: ['Cross-chain Transfers', 'Custom Applications', 'Secure Messaging', 'Multi-chain Support'],
      links: [
        { 
          title: 'IBC Overview', 
          href: '/docs/ibc/index',
          description: 'Understanding IBC fundamentals'
        },
        { 
          title: 'Core Concepts', 
          href: '/docs/ibc/overview',
          description: 'Deep dive into IBC architecture'
        }
      ]
    },
    {
      id: 'cosmos-sdk',
      title: 'Cosmos SDK',
      description: 'Build sovereign blockchains with the modular Cosmos SDK framework',
      longDescription: 'Create custom blockchain applications using the flexible and modular Cosmos SDK, with full control over consensus, governance, and application logic.',
      icon: Cpu,
      color: 'from-[#8791bf] to-[#545e8c]',
      href: '/docs/cosmos-sdk',
      comingSoon: true,
      features: ['Modular Architecture', 'Custom Modules', 'Governance Tools', 'Consensus Engine'],
      links: [
        { 
          title: 'Getting Started', 
          href: '#',
          description: 'Build your first Cosmos chain'
        },
        { 
          title: 'Module Development', 
          href: '#',
          description: 'Create custom SDK modules'
        }
      ]
    },
    {
      id: 'cosmwasm',
      title: 'CosmWasm',
      description: 'Write smart contracts in Rust with WebAssembly runtime',
      longDescription: 'Develop high-performance smart contracts using Rust and WebAssembly, with seamless integration into the Cosmos ecosystem and enhanced security features.',
      icon: Zap,
      color: 'from-orange-500 to-red-500',
      href: '/docs/cosmwasm',
      comingSoon: true,
      features: ['Rust Development', 'WebAssembly Runtime', 'Security First', 'Cosmos Integration'],
      links: [
        { 
          title: 'Contract Development', 
          href: '#',
          description: 'Write your first CosmWasm contract'
        },
        { 
          title: 'Testing Framework', 
          href: '#',
          description: 'Test and debug contracts'
        }
      ]
    },
    {
      id: 'validators',
      title: 'Validator Operations',
      description: 'Run and maintain validator nodes on Cosmos Hub',
      longDescription: 'Learn to operate secure and efficient validator nodes, participate in network consensus, and contribute to the decentralization of Cosmos Hub.',
      icon: Globe,
      color: 'from-blue-500 to-cyan-500',
      href: '/docs/network/validators',
      comingSoon: true,
      features: ['Node Operation', 'Security Best Practices', 'Monitoring Tools', 'Network Participation'],
      links: [
        { 
          title: 'Node Setup', 
          href: '#',
          description: 'Configure and deploy validator nodes'
        },
        { 
          title: 'Security Guidelines', 
          href: '#',
          description: 'Secure your validator infrastructure'
        }
      ]
    },
    {
      id: 'governance',
      title: 'Governance',
      description: 'Participate in on-chain governance and protocol upgrades',
      longDescription: 'Engage with the Cosmos Hub community through on-chain governance, submit proposals, vote on protocol changes, and help shape the future of the network.',
      icon: Book,
      color: 'from-purple-500 to-pink-500',
      href: '/docs/network/governance',
      comingSoon: true,
      features: ['Proposal Submission', 'Community Voting', 'Parameter Changes', 'Protocol Upgrades'],
      links: [
        { 
          title: 'Proposal Process', 
          href: '#',
          description: 'Learn the governance workflow'
        },
        { 
          title: 'Voting Guide', 
          href: '#',
          description: 'Participate in network decisions'
        }
      ]
    }
  ]

  const handleCardHover = (cardId: string | null) => {
    setHoveredCard(cardId)
  }

  const handleCardClick = (href: string) => {
    if (href !== '#') {
      window.location.href = href
    }
  }

  const handleLinkClick = (event: React.MouseEvent, href: string) => {
    event.stopPropagation()
    if (href !== '#') {
      window.location.href = href
    }
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#6976af]/10 via-transparent to-[#545e8c]/10" />
        <div className="absolute inset-0 bg-grid-slate-900/[0.04] dark:bg-grid-slate-100/[0.03] bg-[length:60px_60px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              <span className="bg-gradient-to-r from-[#6976af] to-[#545e8c] bg-clip-text text-transparent">
                Cosmos Hub
              </span>
              <br />
              Developer Documentation
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Build the future of interoperable blockchains with comprehensive tools, 
              detailed guides, and cutting-edge technology stack
            </p>
          </div>

          {/* Main Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-16">
            {cards.map((card) => (
              <div
                key={card.id}
                className="group relative"
                onMouseEnter={() => handleCardHover(card.id)}
                onMouseLeave={() => handleCardHover(null)}
              >
                <div
                  className={`
                    relative h-full cursor-pointer overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-900/90 backdrop-blur-sm
                    transition-all duration-300 ease-out
                    ${hoveredCard === card.id ? 'scale-105 shadow-2xl border-[#6976af]/50' : 'hover:shadow-xl hover:scale-[1.02]'}
                    ${card.comingSoon ? 'opacity-75' : ''}
                  `}
                  onClick={() => handleCardClick(card.href)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Navigate to ${card.title} documentation`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCardClick(card.href)
                    }
                  }}
                >
                  {/* Card Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        bg-gradient-to-br ${card.color} shadow-lg
                        transition-transform duration-300 group-hover:scale-110
                      `}>
                        <card.icon className="w-6 h-6 text-white" />
                      </div>
                      
                      {card.comingSoon && (
                        <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {card.title}
                    </h3>
                    
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                      {card.description}
                    </p>

                    {/* Features List */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {card.features.slice(0, 3).map((feature, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="px-6 pb-6">
                    <div className="space-y-2">
                      {card.links.slice(0, 2).map((link, index) => (
                        <a
                          key={index}
                          href={link.href}
                          onClick={(e) => handleLinkClick(e, link.href)}
                          className={`
                            flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600
                            hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200
                            ${link.href === '#' ? 'cursor-not-allowed opacity-50' : 'hover:border-[#6976af]/50'}
                          `}
                          tabIndex={0}
                          aria-label={link.description || link.title}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {link.title}
                            </div>
                            {link.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {link.description}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#6976af] transition-colors" />
                        </a>
                      ))}
                    </div>

                    {/* View All Link */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <a
                        href={card.href}
                        onClick={(e) => handleLinkClick(e, card.href)}
                        className={`
                          inline-flex items-center text-sm font-medium transition-colors
                          ${card.href === '#' 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-[#6976af] hover:text-[#545e8c] dark:text-[#8791bf] dark:hover:text-[#6976af]'
                          }
                        `}
                        tabIndex={0}
                      >
                        View all documentation
                        <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                      </a>
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div className={`
                    absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300
                    bg-gradient-to-br ${card.color} 
                    ${hoveredCard === card.id ? 'opacity-5' : ''}
                  `} />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA Section */}
          <div className="text-center">
            <div className="inline-flex flex-col sm:flex-row gap-4">
              <a
                href="/docs/cosmos-evm/quickstart"
                className="inline-flex items-center px-8 py-4 rounded-xl bg-gradient-to-r from-[#6976af] to-[#545e8c] text-white font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                tabIndex={0}
                aria-label="Start building with Cosmos EVM"
              >
                Start Building
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
              <a
                href="https://github.com/cosmos"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-4 rounded-xl border-2 border-[#6976af] text-[#6976af] dark:text-[#8791bf] hover:bg-[#6976af] hover:text-white transition-all duration-200"
                tabIndex={0}
                aria-label="View Cosmos on GitHub"
              >
                View on GitHub
                <ExternalLink className="w-5 h-5 ml-2" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}