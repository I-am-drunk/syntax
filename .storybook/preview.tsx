import type { Preview } from '@storybook/react-vite'
import '../src/styles.css'
import '../src/ui/syntaxPlatform.css'
import '../src/ui/sdk/syntaxUi.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Syntax surface theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light'
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = theme
      }
      return (
        <div
          style={{
            padding: 24,
            minHeight: '100vh',
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        >
          <Story />
        </div>
      )
    },
  ],
}

export default preview
