type ResumeHeaderProps = {
  title: string
  headline: string
  contact: string
}

const ResumeHeader = ({ title, headline, contact }: ResumeHeaderProps) => {
  return (
    <header className="resume-header">
      <div className="resume-header__identity">
        <h1>{title}</h1>
      </div>
      <div className="resume-header__summary">
        <p>{headline}</p>
        <p>{contact}</p>
      </div>
    </header>
  )
}

export default ResumeHeader
