import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { IconContext } from '@phosphor-icons/react';
import './index.css';

if (typeof window !== 'undefined') {
  const origPrint = window.print;
  window.print = function () {
    if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
      window.AndroidPrint.print();
    } else if (origPrint) {
      origPrint.call(window);
    }
  };

  // Android WebView/Chrome ignore @page margins → zero them and let .print-frame supply margins.
  if (window.AndroidPrint || /Android/i.test(navigator.userAgent)) {
    document.documentElement.classList.add('android-print');
    const style = document.createElement('style');
    style.textContent = '@media print { @page { margin: 0; } }';
    document.head.appendChild(style);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <IconContext.Provider
          value={{
            color: 'currentColor',
            weight: 'regular',
            mirrored: false,
          }}
        >
          <App />
        </IconContext.Provider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);