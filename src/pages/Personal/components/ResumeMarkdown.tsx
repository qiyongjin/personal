import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type ResumeMarkdownProps = {
  content: string
}

const markdownComponents: Components = {
  h2({ children }) {
    return <h2 className="resume-markdown__section-title">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="resume-markdown__item-title">{children}</h3>
  },
  p({ children }) {
    return <p className="resume-markdown__paragraph">{children}</p>
  },
  ul({ children }) {
    return <ul className="resume-markdown__list">{children}</ul>
  },
  ol({ children }) {
    return <ol className="resume-markdown__ordered-list">{children}</ol>
  },
  li({ children }) {
    return <li className="resume-markdown__list-item">{children}</li>
  },
  strong({ children }) {
    return <strong className="resume-markdown__strong">{children}</strong>
  },
  table({ children }) {
    return (
      <div className="resume-markdown__table-wrap">
        <table>{children}</table>
      </div>
    )
  },
  blockquote({ children }) {
    return <blockquote className="resume-markdown__quote">{children}</blockquote>
  },
}

const ResumeMarkdown = ({ content }: ResumeMarkdownProps) => {
  return (
    <article className="resume-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </article>
  )
}

export default ResumeMarkdown
