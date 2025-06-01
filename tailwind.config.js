/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
      './app/**/*.{js,ts,jsx,tsx}'
    ],
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          primary: {
            DEFAULT: '#6976af', // Cosmos blue
            dark: '#4a5a8c',
            light: '#8b9ad1',
          },
          slate: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
          cosmos: {
            50: '#f8f9fa',
            100: '#f1f3f4', 
            200: '#e8eaed',
            300: '#dadce0',
            400: '#bdc1c6',
            500: '#9aa0a6',
            600: '#80868b',
            700: '#5f6368',
            800: '#3c4043',
            900: '#202124'
          },
          evm: {
            50: '#fdf4ff',
            100: '#fae8ff', 
            200: '#f5d0fe',
            300: '#f0abfc',
            400: '#e879f9',
            500: '#d946ef',
            600: '#c026d3',
            700: '#a21caf',
            800: '#86198f',
            900: '#701a75'
          },
          ibc: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe', 
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a'
          }
        },
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace']
        },
        animation: {
          'fade-in': 'fadeIn 0.5s ease-in-out',
          'slide-up': 'slideUp 0.3s ease-out',
          'slide-down': 'slideDown 0.3s ease-out',
          'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'gradient-shift': 'gradientShift 8s ease-in-out infinite',
          'float': 'float 6s ease-in-out infinite'
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' }
          },
          slideUp: {
            '0%': { transform: 'translateY(10px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' }
          },
          slideDown: {
            '0%': { transform: 'translateY(-10px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' }
          },
          pulseSoft: {
            '0%, 100%': { opacity: '1' },
            '50%': { opacity: '0.5' }
          },
          gradientShift: {
            '0%, 100%': { 
              'background-position': '0% 50%'
            },
            '50%': { 
              'background-position': '100% 50%'
            }
          },
          float: {
            '0%, 100%': { 
              transform: 'translateY(0px)'
            },
            '50%': { 
              transform: 'translateY(-10px)'
            }
          }
        },
        backgroundImage: {
          'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
          'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
          'cosmos-gradient': 'linear-gradient(135deg, #6976af 0%, #8791bf 50%, #a5adcf 100%)',
          'evm-gradient': 'linear-gradient(135deg, #d946ef 0%, #e879f9 50%, #f0abfc 100%)',
          'ibc-gradient': 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)'
        },
        boxShadow: {
          'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
          'soft-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          'glow': '0 0 20px rgba(105, 118, 175, 0.3)',
          'glow-evm': '0 0 20px rgba(217, 70, 239, 0.3)',
          'glow-ibc': '0 0 20px rgba(59, 130, 246, 0.3)'
        },
        backdropBlur: {
          xs: '2px'
        }
      }
    },
    plugins: [
      require('@tailwindcss/typography'),
      // Custom plugin for advanced animations and effects
      function({ addUtilities, addComponents }) {
        addUtilities({
          '.text-gradient': {
            'background': 'linear-gradient(135deg, #6976af 0%, #8791bf 100%)',
            '-webkit-background-clip': 'text',
            '-webkit-text-fill-color': 'transparent',
            'background-clip': 'text'
          },
          '.text-gradient-evm': {
            'background': 'linear-gradient(135deg, #d946ef 0%, #e879f9 100%)',
            '-webkit-background-clip': 'text', 
            '-webkit-text-fill-color': 'transparent',
            'background-clip': 'text'
          },
          '.text-gradient-ibc': {
            'background': 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
            '-webkit-background-clip': 'text',
            '-webkit-text-fill-color': 'transparent', 
            'background-clip': 'text'
          }
        })
        
        addComponents({
          '.card-hover': {
            'transition': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              'transform': 'translateY(-8px)',
              'box-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }
          },
          '.glass': {
            'background': 'rgba(255, 255, 255, 0.1)',
            'backdrop-filter': 'blur(10px)',
            'border': '1px solid rgba(255, 255, 255, 0.2)'
          },
          '.glass-dark': {
            'background': 'rgba(0, 0, 0, 0.1)',
            'backdrop-filter': 'blur(10px)',
            'border': '1px solid rgba(255, 255, 255, 0.1)'
          }
        })
      }
    ]
  }