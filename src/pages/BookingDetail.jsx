import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ReviewModal from '../components/ReviewModal'
import PaymentModal from '../components/PaymentModal' // ← ADD THIS
import '../styles/BookingDetail.css'

function BookingDetail() {
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false) // ← ADD THIS
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (id) {
      fetchBookingDetails()
    }
  }, [id])

  const fetchBookingDetails = async () => {
    try {
      console.log('Fetching booking with ID:', id)

      // Step 1: Get the booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single()

      if (bookingError || !bookingData) {
        console.error('Booking not found:', bookingError)
        alert('Booking not found')
        navigate(-1)
        return
      }

      console.log('Booking found:', bookingData)

      // Step 2: Get customer info
      const { data: customerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', bookingData.customer_id)
        .single()

      // Step 3: Get provider info
      const { data: providerData } = await supabase
        .from('service_providers')
        .select('*')
        .eq('id', bookingData.provider_id)
        .single()

      // Step 4: Get provider's profile
      let providerProfile = null
      if (providerData) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', providerData.user_id)
          .single()
        providerProfile = data
      }

      // Step 5: Get service category (from provider or booking)
      let categoryData = null
      if (providerData && providerData.category_id) {
        const { data } = await supabase
          .from('service_categories')
          .select('*')
          .eq('id', providerData.category_id)
          .single()
        categoryData = data
      }

      // Combine all data
      const fullBookingData = {
        ...bookingData,
        customer: customerData || {},
        provider: {
          ...providerData,
          profiles: providerProfile || {}
        },
        category: categoryData
      }

      console.log('Full booking data:', fullBookingData)

      // Check access permission
      const isCustomer = user.id === bookingData.customer_id
      const isProvider = providerData && user.id === providerData.user_id

      if (!isCustomer && !isProvider && profile?.role !== 'admin') {
        alert('You do not have permission to view this booking')
        navigate(-1)
        return
      }

      setBooking(fullBookingData)

      // Fetch review if booking is completed
      if (bookingData.status === 'completed') {
        const { data: reviewData } = await supabase
          .from('reviews')
          .select('*')
          .eq('booking_id', id)
          .single()

        if (reviewData) {
          setReview(reviewData)
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error in fetchBookingDetails:', err)
      alert('Error loading booking details')
      navigate(-1)
    }
  }

  const updateBookingStatus = async (newStatus) => {
    setUpdating(true)
    
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      alert(`Booking ${newStatus} successfully`)
      fetchBookingDetails()
      
      // Update provider stats if completed
      if (newStatus === 'completed' && booking.provider) {
        await supabase
          .from('service_providers')
          .update({ 
            total_jobs: (booking.provider.total_jobs || 0) + 1 
          })
          .eq('id', booking.provider.id)
      }
    } else {
      console.error('Error updating booking:', error)
      alert('Error updating booking status')
    }
    
    setUpdating(false)
  }

  const cancelBooking = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    await updateBookingStatus('cancelled')
  }

  // ← ADD THIS: Confirm offline payment (for providers)
  const confirmOfflinePayment = async () => {
    if (!confirm('Confirm that you have received payment from the customer?')) return
    
    setUpdating(true)
    const { error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', booking.id)

    if (!error) {
      alert('Payment confirmed successfully!')
      fetchBookingDetails()
    } else {
      alert('Error confirming payment')
    }
    setUpdating(false)
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

  // ← ADD THIS: Get payment status badge info
  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return { class: 'payment-paid', text: 'Paid', icon: 'bi-check-circle-fill' }
      case 'pending_confirmation':
        return { class: 'payment-pending', text: 'Awaiting Confirmation', icon: 'bi-clock' }
      default:
        return { class: 'payment-unpaid', text: 'Unpaid', icon: 'bi-exclamation-circle' }
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Not set'
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="booking-details-loading">
        <div className="spinner-custom"></div>
        <p>Loading booking details...</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="booking-details-error">
        <i className="bi bi-exclamation-triangle"></i>
        <h3>Unable to load booking</h3>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    )
  }

  const isCustomer = user.id === booking.customer_id
  const isProvider = booking.provider && user.id === booking.provider.user_id

  // Safe data access
  const categoryName = booking.category?.name || 'Service'
  const categoryIcon = booking.category?.icon || 'bi-briefcase'
  const providerName = booking.provider?.profiles?.full_name || 'Provider'
  const customerName = booking.customer?.full_name || 'Customer'

  return (
    <div className="booking-details-page">
      <div className="container">
        {/* Header */}
        <div className="booking-details-header">
          <button 
            className="back-button mt-3"
            onClick={() => navigate(-1)}
          >
            <i className="bi bi-arrow-left fw-bolder text-primary"></i>
            <span>Back</span>
          </button>
          
          <div className="header-actions">
            {(booking.status === 'accepted' || booking.status === 'in_progress') && (
              <Link 
                to={`/chat/${booking.id}`}
                className="btn-modern btn-primary"
              >
                <i className="bi bi-chat-dots"></i>
                <span>Open Chat</span>
              </Link>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="booking-details-content">
          <div className="row g-4">
            {/* Left Column */}
            <div className="col-lg-8">
              {/* Booking Card */}
              <div className="detail-card booking-main-card">
                <div className="booking-header-section">
                  <div className="booking-icon">
                    <i className={`bi ${categoryIcon}`}></i>
                  </div>
                  <div className="booking-title-section">
                    <h2>{categoryName}</h2>
                    <div className="booking-id">
                      Booking ID: <code>#{booking.id.substring(0, 8).toUpperCase()}</code>
                    </div>
                  </div>
                  <div className={`booking-status-badge status-${booking.status}`}>
                    <i className={`bi ${getStatusIcon(booking.status)} me-2`}></i>
                    {booking.status.replace('_', ' ')}
                  </div>
                </div>

                <div className="booking-info-grid">
                  <div className="info-item">
                    <i className="bi bi-calendar-event"></i>
                    <div>
                      <span className="info-label">Scheduled Date</span>
                      <span className="info-value">{formatDate(booking.scheduled_date)}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="bi bi-clock"></i>
                    <div>
                      <span className="info-label">Time</span>
                      <span className="info-value">{booking.scheduled_time || 'Not set'}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="bi bi-geo-alt"></i>
                    <div>
                      <span className="info-label">Location</span>
                      <span className="info-value">{booking.location || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="bi bi-currency-dollar"></i>
                    <div>
                      <span className="info-label">Price</span>
                      <span className="info-value">
                        {booking.price ? `₦${booking.price}` : 
                         booking.provider?.hourly_rate ? `₦${booking.provider.hourly_rate}/hr` : 
                         'To be determined'}
                      </span>
                    </div>
                  </div>
                </div>

                {booking.description && (
                  <div className="booking-description">
                    <h5>Job Description</h5>
                    <p>{booking.description}</p>
                  </div>
                )}
              </div>

              {/* Status Timeline */}
              <div className="detail-card">
                <h4 className="card-title">
                  <i className="bi bi-clock-history me-2"></i>
                  Booking Timeline
                </h4>
                <div className="status-timeline">
                  <div className={`timeline-item completed`}>
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <h6>Booking Created</h6>
                      <p>{new Date(booking.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {(booking.status !== 'pending') && (
                    <div className={`timeline-item ${booking.status === 'cancelled' ? 'cancelled' : 'completed'}`}>
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <h6>{booking.status === 'cancelled' ? 'Booking Cancelled' : 'Provider Responded'}</h6>
                        <p>{booking.status === 'cancelled' ? 'Booking was cancelled' : 'Provider accepted the request'}</p>
                      </div>
                    </div>
                  )}
                  
                  {(booking.status === 'in_progress' || booking.status === 'completed') && (
                    <div className="timeline-item completed">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <h6>Work Started</h6>
                        <p>Service is in progress</p>
                      </div>
                    </div>
                  )}
                  
                  {booking.status === 'completed' && (
                    <div className="timeline-item completed">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <h6>Job Completed</h6>
                        <p>Service completed successfully</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Section */}
              {booking.status === 'completed' && review && (
                <div className="detail-card">
                  <h4 className="card-title">
                    <i className="bi bi-star-fill text-warning me-2"></i>
                    Customer Review
                  </h4>
                  <div className="review-display">
                    <div className="review-header">
                      <div className="review-user">
                        {booking.customer?.avatar_url ? (
                          <img src={booking.customer.avatar_url} alt={customerName} />
                        ) : (
                          <div className="avatar-placeholder">
                            {customerName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h6>{customerName}</h6>
                          <div className="review-stars">
                            {[...Array(5)].map((_, i) => (
                              <i 
                                key={i}
                                className={`bi bi-star-fill ${i < review.rating ? 'text-warning' : 'text-muted'}`}
                              ></i>
                            ))}
                            <span className="ms-2">{review.rating}.0</span>
                          </div>
                        </div>
                      </div>
                      <span className="review-date">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <div className="review-comment">
                        <p>{review.comment}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="col-lg-4">
              {/* Provider/Customer Card */}
              <div className="detail-card person-card">
                <h5 className="card-title">
                  {isCustomer ? (
                    <>
                      <i className="bi bi-person-badge me-2"></i>
                      Service Provider
                    </>
                  ) : (
                    <>
                      <i className="bi bi-person me-2"></i>
                      Customer
                    </>
                  )}
                </h5>
                
                <div className="person-info">
                  <div className="person-header">
                    {isCustomer ? (
                      // Show provider info
                      <>
                        {booking.provider?.profiles?.avatar_url ? (
                          <img 
                            src={booking.provider.profiles.avatar_url} 
                            alt={providerName}
                            className="person-avatar"
                          />
                        ) : (
                          <div className="person-avatar-placeholder">
                            {providerName.charAt(0)}
                          </div>
                        )}
                        <div className="person-details">
                          <h6>{providerName}</h6>
                          <p className="category-badge">
                            <i className="bi bi-briefcase me-1"></i>
                            {categoryName}
                          </p>
                        </div>
                      </>
                    ) : (
                      // Show customer info
                      <>
                        {booking.customer?.avatar_url ? (
                          <img 
                            src={booking.customer.avatar_url} 
                            alt={customerName}
                            className="person-avatar"
                          />
                        ) : (
                          <div className="person-avatar-placeholder">
                            {customerName.charAt(0)}
                          </div>
                        )}
                        <div className="person-details">
                          <h6>{customerName}</h6>
                          <p className="text-muted">Customer</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="person-stats">
                    {isCustomer && booking.provider ? (
                      // Provider stats
                      <>
                        <div className="stat-item">
                          <i className="bi bi-star-fill text-warning"></i>
                          <span>{booking.provider.rating?.toFixed(1) || '0.0'} Rating</span>
                        </div>
                        <div className="stat-item">
                          <i className="bi bi-briefcase-fill"></i>
                          <span>{booking.provider.total_jobs || 0} Jobs</span>
                        </div>
                        <div className="stat-item">
                          <i className="bi bi-clock-fill"></i>
                          <span>{booking.provider.experience_years || 0} Years</span>
                        </div>
                      </>
                    ) : (
                      // Customer info
                      <>
                        {booking.customer?.city && (
                          <div className="stat-item">
                            <i className="bi bi-geo-alt-fill"></i>
                            <span>{booking.customer.city}</span>
                          </div>
                        )}
                        {booking.customer?.email && (
                          <div className="stat-item">
                            <i className="bi bi-envelope-fill"></i>
                            <span>{booking.customer.email}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="person-contact">
                    {(isCustomer ? booking.provider?.profiles?.phone : booking.customer?.phone) && (
                      <a 
                        href={`tel:${isCustomer ? booking.provider.profiles.phone : booking.customer.phone}`}
                        className="contact-btn"
                      >
                        <i className="bi bi-telephone"></i>
                        <span>Call</span>
                      </a>
                    )}
                    {(booking.status === 'accepted' || booking.status === 'in_progress') && (
                      <Link 
                        to={`/chat/${booking.id}`}
                        className="contact-btn primary"
                      >
                        <i className="bi bi-chat-dots"></i>
                        <span>Message</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="detail-card">
                <h5 className="card-title">Actions</h5>
                <div className="action-buttons">
                  {/* Customer Actions */}
                  {isCustomer && (
                    <>
                      {booking.status === 'pending' && (
                        <button
                          className="btn-action btn-danger"
                          onClick={cancelBooking}
                          disabled={updating}
                        >
                          <i className="bi bi-x-circle"></i>
                          Cancel Booking
                        </button>
                      )}

                      {/* ✅ PAYMENT BUTTON - Show when completed and not paid */}
                      {booking.status === 'completed' && booking.payment_status !== 'paid' && (
                        <button
                          className="btn-action btn-success"
                          onClick={() => setShowPaymentModal(true)}
                        >
                          <i className="bi bi-credit-card"></i>
                          Make Payment
                        </button>
                      )}

                      {/* REVIEW BUTTON - Only after payment */}
                      {booking.status === 'completed' && booking.payment_status === 'paid' && !review && (
                        <button
                          className="btn-action btn-warning"
                          onClick={() => setShowReviewModal(true)}
                        >
                          <i className="bi bi-star"></i>
                          Leave Review
                        </button>
                      )}
                    </>
                  )}

                  {/* Provider Actions */}
                  {isProvider && (
                    <>
                      {booking.status === 'pending' && (
                        <>
                          <button
                            className="btn-action btn-success"
                            onClick={() => updateBookingStatus('accepted')}
                            disabled={updating}
                          >
                            <i className="bi bi-check-circle"></i>
                            Accept Booking
                          </button>
                          <button
                            className="btn-action btn-danger"
                            onClick={() => updateBookingStatus('cancelled')}
                            disabled={updating}
                          >
                            <i className="bi bi-x-circle"></i>
                            Reject
                          </button>
                        </>
                      )}
                      {booking.status === 'accepted' && (
                        <button
                          className="btn-action btn-primary"
                          onClick={() => updateBookingStatus('in_progress')}
                          disabled={updating}
                        >
                          <i className="bi bi-play-circle"></i>
                          Start Work
                        </button>
                      )}
                      {booking.status === 'in_progress' && (
                        <button
                          className="btn-action btn-success"
                          onClick={() => updateBookingStatus('completed')}
                          disabled={updating}
                        >
                          <i className="bi bi-check-circle-fill"></i>
                          Mark as Completed
                        </button>
                      )}

                      {/* ✅ CONFIRM OFFLINE PAYMENT - For providers */}
                      {booking.status === 'completed' && booking.payment_status === 'pending_confirmation' && (
                        <button
                          className="btn-action btn-success"
                          onClick={confirmOfflinePayment}
                          disabled={updating}
                        >
                          <i className="bi bi-cash-coin"></i>
                          Confirm Payment Received
                        </button>
                      )}
                    </>
                  )}

                  <button
                    className="btn-action btn-outline"
                    onClick={() => window.print()}
                  >
                    <i className="bi bi-printer"></i>
                    Print Details
                  </button>
                </div>

                {/* ✅ PAYMENT STATUS DISPLAY */}
                {booking.status === 'completed' && (
                  <div className={`payment-status-display ${getPaymentStatusBadge(booking.payment_status).class}`}>
                    <i className={`bi ${getPaymentStatusBadge(booking.payment_status).icon} me-2`}></i>
                    <div>
                      <strong>{getPaymentStatusBadge(booking.payment_status).text}</strong>
                      {booking.payment_status === 'paid' && (
                        <span className="payment-details-small d-block">
                          {booking.payment_method === 'online' ? '💳 Paid Online' : '💵 Paid Offline'} 
                          {booking.payment_amount && ` - ₦${booking.payment_amount.toLocaleString()}`}
                        </span>
                      )}
                      {booking.payment_status === 'pending_confirmation' && (
                        <span className="payment-details-small d-block">
                          Waiting for provider to confirm receipt
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Help Card */}
              <div className="detail-card help-card">
                <h5 className="card-title">
                  <i className="bi bi-question-circle me-2"></i>
                  Need Help?
                </h5>
                <p>If you have any issues with this booking, please contact support.</p>
                <a href="mailto:support@khsa.com" className="btn-action btn-outline">
                  <i className="bi bi-envelope"></i>
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ PAYMENT MODAL */}
      {showPaymentModal && (
        <PaymentModal
          booking={booking}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(method) => {
            setShowPaymentModal(false)
            alert(`Payment ${method === 'online' ? 'completed' : 'recorded'} successfully!`)
            fetchBookingDetails()
          }}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal
          booking={booking}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false)
            fetchBookingDetails()
          }}
        />
      )}
    </div>
  )
}

export default BookingDetail