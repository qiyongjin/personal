import resumeMarkdown from '../../content/resume.md?raw'
import ResumeActions from './components/ResumeActions'
import ResumeHeader from './components/ResumeHeader'
import ResumeMarkdown from './components/ResumeMarkdown'
import './index.css'

const getResumeIntro = (markdown: string) => {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return {
    title: lines[0]?.replace(/^#\s+/, '') ?? '个人简历',
    headline: lines[1] ?? '',
    contact: lines[2] ?? '',
  }
}

const getResumeBody = (markdown: string) => {
  const lines = markdown.split('\n')
  let nonEmptyCount = 0
  let bodyStartIndex = 0

  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue
    }

    nonEmptyCount += 1

    if (nonEmptyCount === 3) {
      bodyStartIndex = index + 1
      break
    }
  }

  return lines.slice(bodyStartIndex).join('\n').trim()
}

const resumeIntro = getResumeIntro(resumeMarkdown)
const resumeBody = getResumeBody(resumeMarkdown)
const resumePdfHref = '/resume/mini_seven.pdf'

const Personal = () => {
  return (
    <div className="personal-page">
      <div className="personal-page__grain" aria-hidden="true" />
      <ResumeActions fileName="mini_seven.pdf" pdfHref={resumePdfHref} />
      <section className="resume-layout" aria-label="mini_seven">
        <div className="resume-paper">
          <ResumeHeader {...resumeIntro} />
          <ResumeMarkdown content={resumeBody} />
        </div>
      </section>
    </div>
  )
}

export default Personal
