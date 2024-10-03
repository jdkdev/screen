import extractorSvelte from '@unocss/extractor-svelte'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup
} from 'unocss'

const rules = [
  [/^area-(.+)$/, ([, area]) => ({ 'grid-area': area })],
  [
    /^grid-(fit|fill)-cols(?:-(\d+)(px|rem|fr))?$/,
    ([, type, size = 10, unit = 'rem']) => ({
      'grid-template-columns': `repeat(auto-${type}, minmax(${size}${unit}, 1fr))`
    })
  ]
]

export default defineConfig({
  rules,
  theme: {
    screens: {
      textWidth: '38rem',
      contentWidth: '70rem',
      xl: '1280px',
      '1xl': '1440px',
      '2xl': '1536px',
      blockWidth: '160rem'
    },
    fontFamily: {
      primary: ['Poppins', 'Helvetica', 'sans-serif'],
      secondary: ['Georgia', 'serif']
    },
    spacing: {
      default: '1rem'
    },
    colors: {
      theme: {
        primary: '#38993a', // green
        secondary: '#E5E7EB', // gray-200
        tertiary: '#8B5CF6', // purple-500
        text: '#444',
        light: '#747474',
        accent: '#25C4F2', // logo-blue
        highlight: '#F9A8D4', // pink-light
        nav: '#E5E7EB', // gray-200
        active: '#38993a', // green
        hover: '#9FC612', // blue
        success: '#9FC612', // green
        critical: '#8B5CF6', // purple-500
        danger: '#E14F44', // red
        info: '#38bdf8', // blue
        warning: '#FFC107', // yellow
        neutral: '#E5E7EB' // gray-200
      },
      chart: {
        purple: '#836fbb',
        teal: '#149b86',
        green: '#9fc612',
        yellow: '#f8dc51',
        red: '#E14f44'
      }
    }
  },
  safelist: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => 'grid-cols-' + i),
  shortcuts: [{ matrix: 'grid children:col-span-2 sm:grid-cols-2' }],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  presets: [
    presetUno(),
    presetTypography(),
    presetIcons({
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle'
      }
    })
  ],
  extractors: [extractorSvelte()]
})
