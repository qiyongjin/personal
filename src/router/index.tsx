import { createBrowserRouter } from 'react-router-dom'
import Home from '../pages/Home/index'
import Personal from '../pages/Personal/index'

const router = createBrowserRouter([
  {
    path: '/resume',
    element: <Personal />,
  },
  {
    path: '/personal',
    element: <Home />,
  },
])

export default router