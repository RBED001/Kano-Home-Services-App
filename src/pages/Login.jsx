import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && profile) {
      // Redirect based on user role
      if (profile.user_role === 'provider') {
        navigate('/provider-dashboard', { replace: true })
      } else {
        navigate('/customer-dashboard', { replace: true })
      }
    }
  }, [user, profile, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      return setError('Please enter your email address')
    }

    if (!password) {
      return setError('Please enter your password')
    }

    setLoading(true)

    const { data, error } = await signIn(email, password)
    
    if (error) {
      setLoading(false)
      
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please verify your email before logging in. Check your inbox.')
      } else if (error.message.includes('Too many requests')) {
        setError('Too many login attempts. Please try again later.')
      } else if (error.message.includes('User not found')) {
        setError('No account found with this email. Please register first.')
      } else {
        setError(error.message || 'Login failed. Please try again.')
      }
    } else {
      navigate('/dashboard')
    }
  }

  const togglePassword = () => {
    setShowPassword(!showPassword)
  }

  // Go back to previous page
  const handleGoBack = () => {
    navigate(-1)
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="auth-card animate-fadeInUp">
            <div className="auth-loading">
              <div className="spinner-large"></div>
              <p>Checking authentication...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Don't render login form if user is authenticated
  if (user && profile) {
    return null
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="auth-card animate-fadeInUp">
          {/* Header */}
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <i className="bi bi-house-gear"></i>
            </Link>
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Login to your KHSA account</p>
          </div>
          
          {/* Body */}
          <div className="auth-body">
            {/* Error Alert */}
            {error && (
              <div className="alert alert-danger animate-fadeIn" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <span>{error}</span>
                <button 
                  type="button" 
                  className="alert-close" 
                  onClick={() => setError('')}
                  aria-label="Close"
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="login-input-wrapper">
                  <i className="bi bi-envelope input-icon"></i>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="login-input-wrapper">
                  <i className="bi bi-lock input-icon"></i>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePassword}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="form-options">
                <label className="checkbox-wrapper">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Logging in...
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right"></i>
                    Login
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="divider">
                <span>or</span>
              </div>

              {/* Register Link */}
              <Link to="/register" className="btn-secondary">
                <i className="bi bi-person-plus"></i>
                Create New Account
              </Link>

              {/* Terms */}
              <p className="terms-text">
                By logging in, you agree to our{' '}
                <Link to="/terms">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy">Privacy Policy</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login