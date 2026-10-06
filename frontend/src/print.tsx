import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import ResumeDocument from '../shared/ResumeDocument'
import { resumeSchema, type Locale, type ResumeData } from '../shared/resume'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/700.css'
import '../shared/resume.css'

declare global {
  interface Window {
    renderResume: (payload: { data: ResumeData; locale: Locale }) => Promise<void>
  }
}

const root = createRoot(document.getElementById('root')!)
window.renderResume = async ({ data, locale }) => {
  const validated = resumeSchema.parse(data)
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
  flushSync(() => root.render(<ResumeDocument data={validated} locale={locale} />))
  // Trigger layout before awaiting fonts, including unicode-range font subsets.
  document.body.getBoundingClientRect()
  await document.fonts.ready
}
