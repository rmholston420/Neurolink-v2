import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.jsx'

// Re-export so existing tests can `import { App } from '../main.jsx'`.
export { App }

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(<App />)
}
