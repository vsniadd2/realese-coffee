import React from 'react'
import { APP_VERSION } from '../config/version'
import './Footer.css'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="footer-text">
          © 2026 Coffee. Made with <span className="footer-heart">♥️</span> around the world
        </p>
        <span className="footer-version">Версия {APP_VERSION}</span>
        <div className="footer-signature">
          Coffee Life Roasters
        </div>
      </div>
    </footer>
  )
}

export default Footer
