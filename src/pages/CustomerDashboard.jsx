import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabaseClient'
import { Link, useNavigate } from 'react-router-dom'
import ReviewModal from '../components/ReviewModal'
import { useUnreadCount } from '../hooks/useUnreadCount'
import '../styles/CustomerDashboard.css'
import LocationPickerModal from '../components/LocationPickerModal'

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom magenta marker
const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function CustomerDashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [reviewingBooking, setReviewingBooking] = useState(null)
  const [reviewedBookings, setReviewedBookings] = useState([])
  const [bookingUnreadCounts, setBookingUnreadCounts] = useState({})
  const [chats, setChats] = useState([])
  const [totalUnreadChats, setTotalUnreadChats] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const unreadCount = useUnreadCount()

  useEffect(() => {
    if (user) {
      fetchBookings()
      checkReviewedBookings()
      fetchUnreadMessagesPerBooking()
      fetchChats()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      const messageSubscription = supabase
        .channel('customer-messages-dashboard')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          },
          () => {
            fetchUnreadMessagesPerBooking()
            fetchChats()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(messageSubscription)
      }
    }
  }, [user?.id])

  useEffect(() => {
    fetchBookings()
    checkReviewedBookings()
    fetchUnreadMessagesPerBooking()
  }, [filter])

  const fetchUnreadMessagesPerBooking = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('booking_id')
        .eq('receiver_id', user.id)
        .eq('read', false)

      if (!error && data) {
        const counts = data.reduce((acc, msg) => {
          acc[msg.booking_id] = (acc[msg.booking_id] || 0) + 1
          return acc
        }, {})
        setBookingUnreadCounts(counts)
      }
    } catch (err) {
      console.error('Error fetching unread messages per booking:', err)
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    let query = supabase
      .from('bookings')
      .select(`
        *,
        service_providers(
          *,
          profiles(full_name, phone, avatar_url),
          service_categories(name)
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (!error) {
      setBookings(data)
    }
    setLoading(false)
  }

  const checkReviewedBookings = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('booking_id')
      .eq('customer_id', user.id)

    if (data) {
      setReviewedBookings(data.map(r => r.booking_id))
    }
  }

  const fetchChats = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          id,
          booking_id,
          sender_id,
          receiver_id,
          message,
          read,
          created_at
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      const bookingIds = [...new Set(messagesData?.map(m => m.booking_id))]
      
      const chatList = []
      let totalUnread = 0

      for (const bookingId of bookingIds) {
        const { data: bookingData } = await supabase
          .from('bookings')
          .select(`
            id,
            status,
            scheduled_date,
            service_providers(
              id,
              profiles(id, full_name, avatar_url),
              service_categories(name)
            )
          `)
          .eq('id', bookingId)
          .single()

        if (bookingData) {
          const bookingMessages = messagesData.filter(m => m.booking_id === bookingId)
          const lastMessage = bookingMessages[0]
          
          const unreadCount = bookingMessages.filter(
            m => m.receiver_id === user.id && !m.read
          ).length

          totalUnread += unreadCount

          chatList.push({
            booking_id: bookingId,
            provider: bookingData.service_providers?.profiles,
            service: bookingData.service_providers?.service_categories?.name,
            status: bookingData.status,
            scheduled_date: bookingData.scheduled_date,
            lastMessage: lastMessage,
            unreadCount: unreadCount
          })
        }
      }

      chatList.sort((a, b) => 
        new Date(b.lastMessage?.created_at) - new Date(a.lastMessage?.created_at)
      )

      setChats(chatList)
      setTotalUnreadChats(totalUnread)
    } catch (err) {
      console.error('Error fetching chats:', err)
    }
  }

  const cancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (!error) {
      alert('Booking cancelled successfully')
      fetchBookings()
    } else {
      alert('Error cancelling booking')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      in_progress: 'status-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    }
    return badges[status] || 'status-default'
  }

  const getStatusIcon = (status) => {
    const icons = {
      pending: 'bi-clock-history',
      accepted: 'bi-check2-circle',
      in_progress: 'bi-gear-fill',
      completed: 'bi-check-circle-fill',
      cancelled: 'bi-x-circle-fill'
    }
    return icons[status] || 'bi-circle'
  }

  const getPaymentBadge = (status) => {
    const badges = {
      paid: 'payment-paid',
      unpaid: 'payment-unpaid',
      pending: 'payment-pending',
      refunded: 'payment-refunded'
    }
    return badges[status] || 'payment-unpaid'
  }

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    active: bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress').length,
    completed: bookings.filter(b => b.status === 'completed').length
  }

  return (
    <div className="customer-dashboard">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button 
          className="menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
        </button>
        <h1 className="mobile-title">Dashboard</h1>
        <div className="mobile-avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} />
          ) : (
            <span>{profile?.full_name?.charAt(0) || 'C'}</span>
          )}
        </div>
      </div>

      <div className="dashboard-container">
        {/* Sidebar */}
        <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="sidebar-content">
            {/* User Profile Card */}
            <div className="sidebar-profile">
              <div className="profile-avatar">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} />
                ) : (
                  <div className="avatar-placeholder">
                    {profile?.full_name?.charAt(0) || 'C'}
                  </div>
                )}
              </div>
              <h4 className="profile-name">{profile?.full_name}</h4>
              <p className="profile-type">
                <i className="bi bi-person-circle me-1"></i>
                Customer Account
              </p>
              <div className="profile-stats">
                <div className="stat">
                  <i className="bi bi-calendar-check"></i>
                  <span>{stats.total} bookings</span>
                </div>
                <div className="stat">
                  <i className="bi bi-star"></i>
                  <span>{stats.completed} completed</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
              <button
                className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false) }}
              >
                <i className="bi bi-grid-1x2-fill"></i>
                <span>Overview</span>
              </button>
             
              <button
                className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => { setActiveTab('bookings'); setMobileMenuOpen(false) }}
              >
                <i className="bi bi-calendar-check-fill"></i>
                <span>My Bookings</span>
                {unreadCount > 0 && (
                  <span className="nav-badge pulse">{unreadCount}</span>
                )}
              </button>

              <button
                className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}
                onClick={() => { setActiveTab('chats'); setMobileMenuOpen(false) }}
              >
                <i className="bi bi-chat-dots-fill"></i>
                <span>Messages</span>
                {totalUnreadChats > 0 && (
                  <span className="nav-badge pulse">{totalUnreadChats}</span>
                )}
              </button>

              <div className="nav-divider"></div>

              <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false) }}
              >
                <i className="bi bi-person-fill"></i>
                <span>Profile Settings</span>
              </button>

              <button
                className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => { setActiveTab('security'); setMobileMenuOpen(false) }}
              >
                <i className="bi bi-shield-lock-fill"></i>
                <span>Security</span>
              </button>

              <div className="nav-divider"></div>

              <Link 
                to="/providers" 
                className="nav-item"
                onClick={() => setMobileMenuOpen(false)}
              >
                <i className="bi bi-search"></i>
                <span>Find Services</span>
              </Link>

              <button className="nav-item logout" onClick={signOut}>
                <i className="bi bi-box-arrow-right"></i>
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {mobileMenuOpen && (
          <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>
        )}

        {/* Main Content */}
        <main className="dashboard-main">
          {activeTab === 'overview' && (
            <OverviewTab 
              stats={stats} 
              bookings={bookings} 
              profile={profile} 
              setActiveTab={setActiveTab}
              getStatusIcon={getStatusIcon}
              bookingUnreadCounts={bookingUnreadCounts}
            />
          )}

          {activeTab === 'bookings' && (
            <BookingsTab
              bookings={bookings}
              loading={loading}
              filter={filter}
              setFilter={setFilter}
              getStatusBadge={getStatusBadge}
              getStatusIcon={getStatusIcon}
              getPaymentBadge={getPaymentBadge}
              cancelBooking={cancelBooking}
              reviewedBookings={reviewedBookings}
              setReviewingBooking={setReviewingBooking}
              bookingUnreadCounts={bookingUnreadCounts}
            />
          )}

          {activeTab === 'chats' && (
            <ChatsTab
              chats={chats}
              user={user}
              fetchChats={fetchChats}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab user={user} profile={profile} />
          )}

          {activeTab === 'security' && (
            <SecurityTab user={user} />
          )}
        </main>
      </div>

      {/* Review Modal */}
      {reviewingBooking && (
        <ReviewModal
          booking={reviewingBooking}
          onClose={() => setReviewingBooking(null)}
          onSuccess={() => {
            checkReviewedBookings()
            fetchBookings()
          }}
        />
      )}
    </div>
  )
}
// ==================== OVERVIEW TAB ====================
function OverviewTab({ stats, bookings, profile, setActiveTab, getStatusIcon, bookingUnreadCounts }) {
  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="tab-content animate-fadeIn">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1>Welcome back, {profile?.full_name?.split(" ")[0]}! 👋</h1>
          <p>Here's what's happening with your bookings today</p>
        </div>
        <div className="header-actions">
          <Link to="/providers" className="btn btn-gradient">
            <i className="bi bi-search me-2"></i>
            Find Services
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary">
            <i className="bi bi-calendar-check"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Bookings</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <i className="bi bi-clock-history"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.pending}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info">
            <i className="bi bi-gear-fill"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.active}</span>
            <span className="stat-label">Active Jobs</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <i className="bi bi-check-circle"></i>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-grid">
        {/* Recent Bookings */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Recent Bookings</h3>
            <button 
              className="btn-link"
              onClick={() => setActiveTab('bookings')}
            >
              View all <i className="bi bi-arrow-right"></i>
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-inbox"></i>
              <p>No bookings yet</p>
              <span>Book a service to get started</span>
            </div>
          ) : (
            <div className="booking-list">
              {recentBookings.map((booking) => (
                <Link 
                  key={booking.id} 
                  to={`/booking/${booking.id}`}
                  className="booking-list-item"
                >
                  <div className="booking-avatar">
                    {booking.service_providers?.profiles?.avatar_url ? (
                      <img src={booking.service_providers.profiles.avatar_url} alt="" />
                    ) : (
                      <span>{booking.service_providers?.profiles?.full_name?.charAt(0) || 'P'}</span>
                    )}
                    {bookingUnreadCounts[booking.id] > 0 && (
                      <span className="unread-dot"></span>
                    )}
                  </div>
                  <div className="booking-info">
                    <h4>{booking.service_providers?.service_categories?.name}</h4>
                    <p>{booking.service_providers?.profiles?.full_name}</p>
                  </div>
                  <div className="booking-meta">
                    <span className="booking-date">
                      {new Date(booking.scheduled_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className={`status-badge ${booking.status}`}>
                      <i className={`bi ${getStatusIcon(booking.status)}`}></i>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <Link to="/providers" className="action-card">
              <div className="action-icon">
                <i className="bi bi-search"></i>
              </div>
              <div className="action-content">
                <h4>Browse Services</h4>
                <p>Find trusted service providers</p>
              </div>
              <i className="bi bi-chevron-right"></i>
            </Link>

            <button 
              className="action-card"
              onClick={() => setActiveTab('bookings')}
            >
              <div className="action-icon">
                <i className="bi bi-calendar-check"></i>
              </div>
              <div className="action-content">
                <h4>View Bookings</h4>
                <p>Manage your service requests</p>
              </div>
              <i className="bi bi-chevron-right"></i>
            </button>

            <button 
              className="action-card"
              onClick={() => setActiveTab('chats')}
            >
              <div className="action-icon">
                <i className="bi bi-chat-dots"></i>
              </div>
              <div className="action-content">
                <h4>Messages</h4>
                <p>Chat with service providers</p>
              </div>
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== BOOKINGS TAB ====================
function BookingsTab({
  bookings,
  loading,
  filter,
  setFilter,
  getStatusBadge,
  getStatusIcon,
  getPaymentBadge,
  cancelBooking,
  reviewedBookings,
  setReviewingBooking,
  bookingUnreadCounts
}) {
  const filters = [
    { value: 'all', label: 'All', count: bookings.length },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>My Bookings</h1>
          <p>Manage all your service bookings</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {filters.map((f) => (
          <button
            key={f.value}
            className={`filter-tab ${filter === f.value ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            <span>{f.label}</span>
            {f.value === 'all' && <span className="count">{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Bookings Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner-custom"></div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state-large">
          <i className="bi bi-calendar-x"></i>
          <h3>No bookings found</h3>
          <p>
            {filter === 'all' 
              ? "You haven't made any bookings yet" 
              : `No ${filter.replace('_', ' ')} bookings`}
          </p>
          <Link to="/providers" className="btn btn-gradient">
            <i className="bi bi-search me-2"></i>
            Browse Services
          </Link>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              {/* Unread indicator */}
              {bookingUnreadCounts[booking.id] > 0 && (
                <div className="unread-indicator">
                  <span>{bookingUnreadCounts[booking.id]}</span>
                  <small>new</small>
                </div>
              )}

              {/* Status Header */}
              <div className={`booking-status-bar ${getStatusBadge(booking.status)}`}>
                <i className={`bi ${getStatusIcon(booking.status)}`}></i>
                <span>{booking.status.replace('_', ' ')}</span>
              </div>

              {/* Payment Status for completed */}
              {booking.status === 'completed' && (
                <div className={`payment-badge ${getPaymentBadge(booking.payment_status)}`}>
                  <i className="bi bi-credit-card"></i>
                  <span>{booking.payment_status || 'Unpaid'}</span>
                  {booking.payment_amount && (
                    <span className="amount">₦{booking.payment_amount.toLocaleString()}</span>
                  )}
                </div>
              )}

              {/* Card Body */}
              <div className="booking-card-body">
                {/* Service */}
                <div className="booking-service">
                  <h3>{booking.service_providers?.service_categories?.name}</h3>
                  <span className="booking-id">#{booking.id.slice(0, 8)}</span>
                </div>

                {/* Provider Info */}
                <div className="booking-provider">
                  <div className="provider-avatar">
                    {booking.service_providers?.profiles?.avatar_url ? (
                      <img src={booking.service_providers.profiles.avatar_url} alt="" />
                    ) : (
                      <span>{booking.service_providers?.profiles?.full_name?.charAt(0) || 'P'}</span>
                    )}
                  </div>
                  <div className="provider-info">
                    <h4>{booking.service_providers?.profiles?.full_name}</h4>
                    <span>Service Provider</span>
                  </div>
                </div>

                {/* Description */}
                {booking.description && (
                  <p className="booking-description">
                    {booking.description.length > 100 
                      ? booking.description.substring(0, 100) + '...'
                      : booking.description}
                  </p>
                )}

                {/* Details Grid */}
                <div className="booking-details">
                  <div className="detail-item">
                    <i className="bi bi-calendar-event"></i>
                    <span>
                      {new Date(booking.scheduled_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <i className="bi bi-clock"></i>
                    <span>{booking.scheduled_time}</span>
                  </div>
                  <div className="detail-item">
                    <i className="bi bi-geo-alt"></i>
                    <span>{booking.location || 'Not specified'}</span>
                  </div>
                  <div className="detail-item">
                    <i className="bi bi-telephone"></i>
                    <span>{booking.service_providers?.profiles?.phone || 'N/A'}</span>
                  </div>
                </div>

                {/* Price if available */}
                {booking.price && (
                  <div className="booking-price">
                    <span>Service Price:</span>
                    <strong>₦{booking.price.toLocaleString()}</strong>
                  </div>
                )}

                {/* Actions */}
                <div className="booking-actions">
                  <Link
                    to={`/booking/${booking.id}`}
                    className="btn-action details"
                  >
                    <i className="bi bi-eye"></i>
                    View Details
                  </Link>

                  {booking.status !== 'cancelled' && booking.status !== 'pending' && (
                    <Link
                      to={`/chat/${booking.id}`}
                      className="btn-action chat"
                    >
                      <i className="bi bi-chat-dots"></i>
                      Chat
                      {bookingUnreadCounts[booking.id] > 0 && (
                        <span className="chat-badge">{bookingUnreadCounts[booking.id]}</span>
                      )}
                    </Link>
                  )}

                  {booking.status === "pending" && (
                    <button
                      className="btn-action reject"
                      onClick={() => cancelBooking(booking.id)}
                    >
                      <i className="bi bi-x-lg"></i>
                      Cancel
                    </button>
                  )}

                  {booking.status === "completed" && !reviewedBookings.includes(booking.id) && (
                    <button
                      className="btn-action review"
                      onClick={() => setReviewingBooking(booking)}
                    >
                      <i className="bi bi-star"></i>
                      Review
                    </button>
                  )}

                  {booking.status === "completed" && reviewedBookings.includes(booking.id) && (
                    <span className="reviewed-badge">
                      <i className="bi bi-check-circle-fill"></i>
                      Reviewed
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ==================== CHATS TAB ====================
function ChatsTab({ chats, user, fetchChats }) {
  const [deleteLoading, setDeleteLoading] = useState(null)

  const handleDeleteChat = async (bookingId) => {
    if (!window.confirm('Delete this conversation? This action cannot be undone.')) {
      return
    }

    setDeleteLoading(bookingId)
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('booking_id', bookingId)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

      if (!error) {
        fetchChats()
      } else {
        alert('Failed to delete chat')
      }
    } catch (err) {
      console.error('Error deleting chat:', err)
      alert('Failed to delete chat')
    } finally {
      setDeleteLoading(null)
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Messages</h1>
          <p>Your conversations with service providers</p>
        </div>
      </div>

      {chats.length === 0 ? (
        <div className="empty-state-large">
          <i className="bi bi-chat-dots"></i>
          <h3>No conversations yet</h3>
          <p>Messages from your bookings will appear here</p>
          <Link to="/providers" className="btn btn-gradient">
            <i className="bi bi-search me-2"></i>
            Browse Services
          </Link>
        </div>
      ) : (
        <div className="chats-container">
          <div className="chat-list">
            {chats.map((chat) => (
              <div key={chat.booking_id} className="chat-item">
                <Link 
                  to={`/chat/${chat.booking_id}`}
                  className="chat-link"
                >
                  <div className="chat-avatar">
                    {chat.provider?.avatar_url ? (
                      <img src={chat.provider.avatar_url} alt="" />
                    ) : (
                      <span>{chat.provider?.full_name?.charAt(0) || 'P'}</span>
                    )}
                    {chat.unreadCount > 0 && (
                      <span className="online-dot"></span>
                    )}
                  </div>

                  <div className="chat-content">
                    <div className="chat-header">
                      <div className="chat-title">
                        <h4>{chat.provider?.full_name || 'Service Provider'}</h4>
                        <span className="service-label">{chat.service}</span>
                      </div>
                      <span className="chat-time">
                        {formatTime(chat.lastMessage?.created_at)}
                      </span>
                    </div>
                    <div className="chat-preview">
                      <p className={chat.unreadCount > 0 ? 'unread' : ''}>
                        {chat.lastMessage?.sender_id === user.id && (
                          <span className="you-prefix">You: </span>
                        )}
                        {chat.lastMessage?.message || 'No messages yet'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="unread-count">{chat.unreadCount}</span>
                      )}
                    </div>
                    <div className="chat-status">
                      <span className={`status-tag ${chat.status}`}>
                        {chat.status?.replace('_', ' ')}
                      </span>
                      <span className="chat-date">
                        <i className="bi bi-calendar me-1"></i>
                        {new Date(chat.scheduled_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>

                <button
                  className="chat-delete-btn"
                  onClick={() => handleDeleteChat(chat.booking_id)}
                  disabled={deleteLoading === chat.booking_id}
                >
                  {deleteLoading === chat.booking_id ? (
                    <span className="spinner-sm"></span>
                  ) : (
                    <i className="bi bi-trash3"></i>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== MAP COMPONENTS ====================
<LocationPickerModal/>
// ==================== PROFILE TAB ====================
function ProfileTab({ user, profile }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile?.avatar_url || null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    address: profile?.address || "",
    city: profile?.city || "",
    latitude: null,
    longitude: null
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size should be less than 2MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError("");
    }
  };

  const handleLocationSelect = (locationData) => {
    setFormData({
      ...formData,
      address: locationData.address,
      latitude: locationData.position.lat,
      longitude: locationData.position.lng
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let avatarUrl = previewUrl;

      if (avatarFile) {
        setUploading(true);
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
        setUploading(false);
      }

      const updates = {
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        updated_at: new Date().toISOString(),
      };

      if (avatarUrl) {
        updates.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Profile Settings</h1>
          <p>Update your personal information</p>
        </div>
      </div>

      {success && (
        <div className="alert-success">
          <i className="bi bi-check-circle-fill"></i>
          {success}
        </div>
      )}

      {error && (
        <div className="alert-error">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {error}
        </div>
      )}

      <div className="settings-card">
        <form onSubmit={handleSubmit}>
          {/* Avatar */}
          <div className="avatar-edit-section">
            <div className="avatar-large">
              {previewUrl ? (
                <img src={previewUrl} alt="" />
              ) : (
                <i className="bi bi-person"></i>
              )}
              <label htmlFor="avatar-edit" className="avatar-edit-btn">
                <i className="bi bi-camera-fill"></i>
              </label>
              <input
                type="file"
                id="avatar-edit"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
                disabled={loading || uploading}
              />
            </div>
            <div className="avatar-info">
              <h4>Profile Photo</h4>
              <p>JPG, PNG or GIF • Max 2MB</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Your phone number"
                required
              />
            </div>

            <div className="form-group">
              <label>City</label>
              <select name="city" value={formData.city} onChange={handleChange}>
                <option value="">Select a city</option>
                <option value="Kano">Kano</option>
                <option value="Kano Municipal">Kano Municipal</option>
                <option value="Fagge">Fagge</option>
                <option value="Dala">Dala</option>
                <option value="Gwale">Gwale</option>
                <option value="Tarauni">Tarauni</option>
                <option value="Nassarawa">Nassarawa</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user?.email} disabled />
              <span className="input-hint">Email cannot be changed</span>
            </div>
          </div>

          {/* Address with Map Button */}
          <div className="form-group full-width">
            <label>Address</label>
            <div className="address-input-wrapper">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter your address or use map to select"
              />
              <button
                type="button"
                className="btn-map-select"
                onClick={() => setShowMapModal(true)}
              >
                <i className="bi bi-map"></i>
                <span>Select on Map</span>
              </button>
            </div>
            <span className="input-hint">
              <i className="bi bi-info-circle"></i>
              You can type your address manually or use the map for precise location
            </span>
          </div>

          <button 
            type="submit" 
            className="btn btn-gradient btn-lg"
            disabled={loading || uploading}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onSelectLocation={handleLocationSelect}
        initialPosition={formData.latitude && formData.longitude ? {
          lat: formData.latitude,
          lng: formData.longitude
        } : null}
      />
    </div>
  );
}// ==================== SECURITY TAB ====================
function SecurityTab({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.newPassword !== formData.confirmPassword) {
      return setError("New passwords do not match");
    }

    if (formData.newPassword.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) throw error;

      setSuccess("Password updated successfully!");
      setFormData({
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Account Function
  const handleDeleteAccount = async () => {
    setDeleteError("");
    
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError("Please type DELETE to confirm");
      return;
    }

    setDeleteLoading(true);

    try {
      // Delete user's bookings
      await supabase
        .from('bookings')
        .delete()
        .eq('customer_id', user.id);

      // Delete reviews
      await supabase
        .from('reviews')
        .delete()
        .eq('customer_id', user.id);

      // Delete messages
      await supabase
        .from('messages')
        .delete()
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      // Delete profile
      await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      // Sign out
      await supabase.auth.signOut();
      
      alert('Your account has been deleted successfully.');
      navigate('/');
      
    } catch (error) {
      console.error('Delete account error:', error);
      setDeleteError(error.message || 'Failed to delete account. Please contact support.');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Security Settings</h1>
          <p>Manage your password and account security</p>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="settings-card">
        <div className="settings-section-header">
          <div className="section-icon">
            <i className="bi bi-key-fill"></i>
          </div>
          <div className="section-info">
            <h3>Change Password</h3>
            <p>Update your account password</p>
          </div>
        </div>

        {success && (
          <div className="alert-success">
            <i className="bi bi-check-circle-fill"></i>
            {success}
          </div>
        )}

        {error && (
          <div className="alert-error">
            <i className="bi bi-exclamation-triangle-fill"></i>
            {error}
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="form-grid">
            <div className="form-group">
              <label>New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Enter new password"
                  required
                  minLength="6"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              <span className="input-hint">Minimum 6 characters</span>
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  required
                  minLength="6"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-gradient btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span>
                Updating...
              </>
            ) : (
              <>
                <i className="bi bi-shield-lock me-2"></i>
                Update Password
              </>
            )}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="settings-card danger-zone">
        <div className="settings-section-header danger">
          <div className="section-icon danger">
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div className="section-info">
            <h3>Danger Zone</h3>
            <p>Irreversible and destructive actions</p>
          </div>
        </div>

        <div className="danger-zone-content">
          <div className="danger-zone-item">
            <div className="danger-info">
              <h4>Delete Account</h4>
              <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
            </div>
            <button 
              className="btn-danger-outline"
              onClick={() => setShowDeleteModal(true)}
            >
              <i className="bi bi-trash me-2"></i>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="delete-modal animate-bounceIn" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <h3>Delete Account?</h3>
            </div>
            
            <div className="delete-modal-body">
              <p className="warning-text">
                This action cannot be undone. This will permanently delete your account and remove all your data.
              </p>
              
              <div className="delete-warning-list">
                <h5>The following will be deleted:</h5>
                <ul>
                  <li>
                    <i className="bi bi-x-circle"></i>
                    Your profile and personal information
                  </li>
                  <li>
                    <i className="bi bi-x-circle"></i>
                    All your bookings and booking history
                  </li>
                  <li>
                    <i className="bi bi-x-circle"></i>
                    All your reviews and ratings
                  </li>
                  <li>
                    <i className="bi bi-x-circle"></i>
                    All your messages and conversations
                  </li>
                </ul>
              </div>

              {deleteError && (
                <div className="alert-error">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  {deleteError}
                </div>
              )}

              <div className="confirm-input">
                <label>
                  Type <span className="highlight">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  disabled={deleteLoading}
                />
              </div>
            </div>

            <div className="delete-modal-footer">
              <button 
                className="btn-modal-cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                className="btn-modal-delete"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
              >
                {deleteLoading ? (
                  <>
                    <span className="spinner-sm"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash me-2"></i>
                    Yes, Delete My Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDashboard;