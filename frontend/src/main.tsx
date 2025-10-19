import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'  // ✅ ADD THIS
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>  {/* ✅ ADD THIS WRAPPER */}
      <App />
    </AuthProvider>  {/* ✅ CLOSE WRAPPER */}
  </StrictMode>,
)
