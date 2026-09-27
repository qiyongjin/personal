import './App.css'
import { type ReactNode } from 'react'

function App({ children }: { children: ReactNode }) {
  return <main className="app-shell">{children}</main>
}

export default App
