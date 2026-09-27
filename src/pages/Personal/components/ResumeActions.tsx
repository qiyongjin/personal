type ResumeActionsProps = {
  fileName: string
  pdfHref: string
}

const ResumeActions = ({ fileName, pdfHref }: ResumeActionsProps) => {

  const downloadPdf = (href: string, fileName: string) => {
    console.log(pdfHref, fileName, href, 'downloadPdf')
    fetch(href, { method: 'GET', cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Network error');
      return response.blob();
    })
    .then(blob => {
      // 强制指定类型为 application/pdf
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfBlob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    })
    .catch(() => {
      // 降级处理：直接新标签页打开
      window.open(href, '_blank');
    });
  }

  return (
    <a className="resume-actions__download"
    href="#"
    onClick={(event) => {
      event.preventDefault()
      downloadPdf(pdfHref, fileName)
    }}
    aria-label="下载 PDF 简历">下载简历</a>
  )
}

export default ResumeActions
