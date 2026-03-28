import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Header.css'

const getPointDisplayName = (user) => {
  if (!user?.username) return ''
  const u = user.username.toLowerCase()
  if (u === 'chervenskiy') return 'Червенский'
  if (u === 'valeryanova') return 'Валерьянова'
  if (u === 'admin') return 'АЧервенский'
  return user.pointName || user.username
}

const Header = ({ onAddClient, onSelectClient, currentPage, onNavigate }) => {
  const { logout, user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [menuOpen, setMenuOpen] = useState(false)
  const [pointMenuOpen, setPointMenuOpen] = useState(false)
  const pointMenuRef = useRef(null)
  const pointLabel = getPointDisplayName(user)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  useEffect(() => {
    if (!pointMenuOpen) return
    const handleClickOutside = (e) => {
      if (pointMenuRef.current && !pointMenuRef.current.contains(e.target)) {
        setPointMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [pointMenuOpen])

  const closeMenu = () => {
    setMenuOpen(false)
    setPointMenuOpen(false)
  }

  const handleNav = (page) => {
    onNavigate?.(page)
    closeMenu()
  }

  const handleLogout = () => {
    logout()
    closeMenu()
  }

  return (
    <header className={`header ${menuOpen ? 'menu-open' : ''}`}>
      <div className="header-left">
        <div 
          className="logo"
          onClick={() => onNavigate?.('new-client')}
          style={{ cursor: 'pointer' }}
        >
          <img src="/img/coffee-svgrepo-com.svg" alt="Coffee" className="coffee-icon" />
          <h1>Coffee Life Roasters CRM</h1>
        </div>
      </div>
      <div className="header-right">
        <nav className="header-nav header-nav-desktop">
          <button
            type="button"
            onClick={() => onNavigate?.('new-client')}
            className={`nav-link ${currentPage === 'new-client' ? 'active' : ''}`}
          >
            Новый заказ
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('clients')}
            className={`nav-link ${currentPage === 'clients' ? 'active' : ''}`}
          >
            Клиенты
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('purchase-history')}
            className={`nav-link ${currentPage === 'purchase-history' ? 'active' : ''}`}
          >
            История
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('stats')}
            className={`nav-link ${currentPage === 'stats' ? 'active' : ''}`}
          >
            Графики
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate?.('categories')}
              className={`nav-link ${currentPage === 'categories' ? 'active' : ''}`}
              title="Категории и товары"
            >
              Категории и товары
            </button>
          )}
        </nav>
        {pointLabel && (
          <div className="header-point-wrap" ref={pointMenuRef}>
            <button
              type="button"
              className="header-point-btn"
              onClick={() => setPointMenuOpen((v) => !v)}
              aria-expanded={pointMenuOpen}
              aria-haspopup="true"
              title="Текущая точка"
            >
              {pointLabel}
            </button>
            {pointMenuOpen && (
              <div className="header-point-dropdown">
                <button type="button" className="header-point-dropdown-item" onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
        >
          <span className="mobile-menu-toggle-bars">
            <span className="mobile-menu-toggle-bar" />
            <span className="mobile-menu-toggle-bar" />
            <span className="mobile-menu-toggle-bar" />
          </span>
        </button>
      </div>

      <div
        className="mobile-menu-backdrop"
        aria-hidden="true"
        onClick={closeMenu}
      />
      <nav className="mobile-nav" aria-label="Основное меню">
        <div className="mobile-nav-inner">
          <button
            type="button"
            onClick={() => handleNav('new-client')}
            className={`mobile-nav-link ${currentPage === 'new-client' ? 'active' : ''}`}
          >
            Новый заказ
          </button>
          <button
            type="button"
            onClick={() => handleNav('clients')}
            className={`mobile-nav-link ${currentPage === 'clients' ? 'active' : ''}`}
          >
            Клиенты
          </button>
          <button
            type="button"
            onClick={() => handleNav('purchase-history')}
            className={`mobile-nav-link ${currentPage === 'purchase-history' ? 'active' : ''}`}
          >
            История
          </button>
          <button
            type="button"
            onClick={() => handleNav('stats')}
            className={`mobile-nav-link ${currentPage === 'stats' ? 'active' : ''}`}
          >
            Графики
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleNav('categories')}
              className={`mobile-nav-link ${currentPage === 'categories' ? 'active' : ''}`}
            >
              Категории и товары
            </button>
          )}
          {pointLabel && (
            <div className="mobile-nav-point">
              <button
                type="button"
                className="mobile-nav-point-btn"
                onClick={() => setPointMenuOpen((v) => !v)}
                aria-expanded={pointMenuOpen}
              >
                {pointLabel}
              </button>
              {pointMenuOpen && (
                <button type="button" className="mobile-nav-link mobile-nav-logout" onClick={handleLogout}>
                  Выйти
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Header
