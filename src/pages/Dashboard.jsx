import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      return
    }

    if (!profile) {
      alert('Your account has been deleted or deactivated. Please contact support.')
      signOut()
      navigate('/login')
      return
    }

    if (profile.role === 'customer') {
      navigate('/customer-dashboard', { replace: true })
    } else if (profile.role === 'provider') {
      navigate('/provider-dashboard', { replace: true })
    } else if (profile.role === 'admin') {
      navigate('/admin', { replace: true })
    }
  }, [user, profile, loading, navigate, signOut])

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return null
}

export default Dashboard