import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import router from './router/index.tsx'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/700.css'
import '../shared/resume.css'
import App from './App.tsx'
import I18nProvider from 'i18n/Provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><App>
      <RouterProvider router={router} />
    </App></I18nProvider>
  </StrictMode>,
)
