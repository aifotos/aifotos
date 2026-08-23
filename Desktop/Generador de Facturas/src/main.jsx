import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { conectarConsola } from './lib/logging.js'

// Manda los errores del webview al log antes de montar React, para que un
// fallo durante el arranque tambien quede registrado.
conectarConsola()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
