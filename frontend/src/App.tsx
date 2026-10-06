import './App.css'
import { type ReactNode } from 'react'

function App({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>
}

export default App
