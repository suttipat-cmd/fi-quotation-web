import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const pendingRoute = sessionStorage.getItem('fi-quotation-web-route')
if (pendingRoute) {
  sessionStorage.removeItem('fi-quotation-web-route')
  window.history.replaceState({}, '', `${import.meta.env.BASE_URL.replace(/\/$/, '')}${pendingRoute}`)
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
