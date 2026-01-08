import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Navbar.css'

function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Handle scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Close navbar when route changes (mobile)
  useEffect(() => {
    closeNavbar()
    setDropdownOpen(false)
  }, [location.pathname])

  // Close navbar function
  const closeNavbar = () => {
    setMenuOpen(false)
    const navbarCollapse = document.getElementById('navbarNav')
    if (navbarCollapse?.classList.contains('show')) {
      navbarCollapse.classList.remove('show')
    }
  }

  // Toggle menu
  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
    const navbarCollapse = document.getElementById('navbarNav')
    if (navbarCollapse) {
      navbarCollapse.classList.toggle('show')
    }
  }

  // Toggle dropdown
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen)
  }

  // Handle logout
 // Handle logout
const handleLogout = async () => {
  setDropdownOpen(false)
  closeNavbar()
  try {
    await signOut()
  } catch (error) {
    console.error('Logout error:', error)
  }
}

  const isHome = location.pathname === '/'
  const isTransparent = isHome && !scrolled && !menuOpen

  // Determine navbar classes
  const navbarClass = `navbar navbar-expand-lg fixed-top ${
    isTransparent ? 'navbar-transparent' : 'navbar-custom'
  } ${scrolled ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`

  // Determine brand link destination based on role
  const getBrandLink = () => {
    if (profile?.role === 'admin') return '/admin'
    return '/'
  }

  return (
    <nav className={navbarClass}>
      <div className="container">
        {/* Brand */}
        <Link className="navbar-brand-custom" to={getBrandLink()} onClick={closeNavbar}>
          <i className="bi bi-house-gear"></i>
          KHSA
        </Link>

        {/* Toggler - Manual Toggle */}
        <button
          className={`navbar-toggler ${menuOpen ? 'active' : ''}`}
          type="button"
          onClick={toggleMenu}
          aria-controls="navbarNav"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Nav Items */}
        <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`} id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-lg-center">
            
            {/* ===== ROLE-BASED NAVIGATION ===== */}
            
            {user ? (
              <>
                {/* ADMIN NAVIGATION - Only Admin Dashboard */}
                {profile?.role === 'admin' && (
                  <>
                    <li className="nav-item">
                      <Link
                        className={`nav-link-custom ${location.pathname === '/admin' ? 'active' : ''}`}
                        to="/admin"
                        onClick={closeNavbar}
                      >
                        <i className="bi bi-shield-lock me-2"></i>
                        Admin Dashboard
                      </Link>
                    </li>
                  </>
                )}

                {/* CUSTOMER NAVIGATION - Home, Find Services, Dashboard */}
                {profile?.role === 'customer' && (
                  <>
                    {/* Home Link */}
                    <li className="nav-item">
                      <Link
                        className={`nav-link-custom ${location.pathname === '/' ? 'active' : ''}`}
                        to="/"
                        onClick={closeNavbar}
                      >
                        <i className="bi bi-house-door me-2 d-lg-none"></i>
                        Home
                      </Link>
                    </li>

                    {/* Find Services Link */}
                    <li className="nav-item">
                      <Link
                        className={`nav-link-custom ${location.pathname === '/providers' ? 'active' : ''}`}
                        to="/providers"
                        onClick={closeNavbar}
                      >
                        <i className="bi bi-search me-2 d-lg-none"></i>
                        Find Services
                      </Link>
                    </li>

                    {/* Dashboard Link */}
                    <li className="nav-item">
                      <Link
                        className={`nav-link-custom ${location.pathname === '/dashboard' ? 'active' : ''}`}
                        to="/dashboard"
                        onClick={closeNavbar}
                      >
                        <i className="bi bi-grid me-2 d-lg-none"></i>
                        My Dashboard
                      </Link>
                    </li>
                  </>
                )}

                {/* PROVIDER NAVIGATION - Home, Dashboard */}
                {profile?.role === 'provider' && (
                  <>
                    {/* Home Link */}
                    <li className="nav-item">
                      <Link
                        className={`nav-link-custom ${location.pathname === '/' ? 'active' : ''}`}
                        to="/"
                        onClick={closeNavbar}
                      >
                        <i className="bi bi-house-door me-2 d-lg-none"></i>
                        Home
                      </Link>
                    </li>

                    {/* Dashboard Link */}
                    <li className="nav-item">
                      <Link
                        className={`nav-link-custom ${location.pathname === '/dashboard' ? 'active' : ''}`}
                        to="/dashboard"
                        onClick={closeNavbar}
                      >
                        <i className="bi bi-briefcase me-2 d-lg-none"></i>
                        Provider Dashboard
                      </Link>
                    </li>
                  </>
                )}

                {/* Profile Dropdown */}
                <li className="nav-item dropdown" ref={dropdownRef}>
                  <button
                    className="nav-link-custom dropdown-toggle-custom"
                    onClick={toggleDropdown}
                    aria-expanded={dropdownOpen}
                  >
                    {/* User Avatar */}
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="user-avatar-nav"
                      />
                    ) : (
                      <div className="avatar-placeholder-nav">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="user-name-nav d-none d-lg-inline">
                      {profile?.full_name?.split(' ')[0] || 'User'}
                    </span>
                    <i className={`bi bi-chevron-down dropdown-arrow ${dropdownOpen ? 'rotated' : ''}`}></i>
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="profile-dropdown-menu">
                      {/* User Info Header */}
                      <div className="dropdown-user-info">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.full_name}
                            className="dropdown-avatar"
                          />
                        ) : (
                          <div className="dropdown-avatar-placeholder">
                            {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="dropdown-user-details">
                          <strong>{profile?.full_name || 'User'}</strong>
                          <small>{user?.email}</small>
                          <span className="user-role-badge">
                            {profile?.role === 'admin' ? 'Administrator' : 
                             profile?.role === 'provider' ? 'Service Provider' : 'Customer'}
                          </span>
                        </div>
                      </div>

                      <div className="dropdown-divider"></div>

                      {/* Logout Button */}
                      <button
                        className="dropdown-item-custom logout-item"
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </li>
              </>
            ) : (
              <>
                {/* NOT LOGGED IN - Show Home, Login, Get Started */}
                {/* Home Link */}
                <li className="nav-item">
                  <Link
                    className={`nav-link-custom ${location.pathname === '/' ? 'active' : ''}`}
                    to="/"
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-house-door me-2 d-lg-none"></i>
                    Home
                  </Link>
                </li>

                {/* Login Link */}
                <li className="nav-item">
                  <Link
                    className="nav-link-custom "
                    to="/login"
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-box-arrow-in-right me-2 d-lg-none"></i>
                    Login
                  </Link>
                </li>

                {/* Get Started Button */}
                <li className="nav-item ms-lg-2">
                  <Link
                    className="btn btn-gradient"
                    to="/register"
                    onClick={closeNavbar}
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Get Started
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}

export default Navbar