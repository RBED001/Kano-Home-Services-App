import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import LocationPickerModal from './LocationPickerModal'
import './BookingModal.css'

function BookingModal({ provider, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [formData, setFormData] = useState({
    description: '',
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    latitude: null,
    longitude: null
  })
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    if (error) setError('')
  }

  const handleLocationSelect = (locationData) => {
    setFormData({
      ...formData,
      location: locationData.address,
      latitude: locationData.position.lat,
      longitude: locationData.position.lng
    })
    setShowMapModal(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.description.trim()) {
      return setError('Please describe the work you need done')
    }
    if (!formData.location.trim()) {
      return setError('Please provide the service location')
    }
    if (!formData.scheduled_date) {
      return setError('Please select a date')
    }
    if (!formData.scheduled_time) {
      return setError('Please select a time')
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          provider_id: provider.id,
          category_id: provider.category_id,
          description: formData.description,
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time,
          location: formData.location,
          status: 'pending'
        })

      if (error) throw error

      alert('Booking request sent successfully! 🎉')
      onClose()
      navigate('/customer-dashboard')
    } catch (error) {
      console.error('Error creating booking:', error)
      setError(error.message || 'Error creating booking. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="booking-modal-wrapper">
      {/* Booking Modal */}
      <div className="bm-overlay" onClick={(e) => {
        if (e.target === e.currentTarget && !showMapModal) onClose()
      }}>
        <div className="bm-modal">
          <div className="bm-header">
            <div className="bm-title">
              <i className="bi bi-calendar-check"></i>
              <span>Book Service</span>
            </div>
            <button type="button" className="bm-close-btn" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          
          <div className="bm-body">
            {/* Provider Summary */}
            <div className="bm-provider-summary">
              <div className="bm-provider-card">
                {provider.profiles?.avatar_url ? (
                  <img
                    src={provider.profiles.avatar_url}
                    alt={provider.profiles.full_name}
                    className="bm-provider-avatar"
                  />
                ) : (
                  <div className="bm-provider-avatar-placeholder">
                    {provider.profiles?.full_name?.charAt(0)}
                  </div>
                )}
                <div className="bm-provider-info">
                  <strong>{provider.profiles?.full_name}</strong>
                  <span>{provider.service_categories?.name}</span>
                </div>
                <div className="bm-provider-price">
                  ₦{(provider.hourly_rate || 0).toLocaleString()}/hr
                </div>
              </div>
            </div>

            {error && (
              <div className="bm-alert bm-alert-error">
                <i className="bi bi-exclamation-triangle"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bm-form">
              {/* Service Description */}
              <div className="bm-form-group">
                <label className="bm-label">
                  <i className="bi bi-card-text"></i>
                  What do you need? <span className="bm-required">*</span>
                </label>
                <textarea
                  className="bm-textarea"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Describe the work you need done in detail..."
                  required
                  disabled={loading}
                ></textarea>
              </div>

              {/* Date & Time */}
              <div className="bm-form-row">
                <div className="bm-form-group">
                  <label className="bm-label">
                    <i className="bi bi-calendar-event"></i>
                    Preferred Date <span className="bm-required">*</span>
                  </label>
                  <input
                    type="date"
                    className="bm-input"
                    name="scheduled_date"
                    value={formData.scheduled_date}
                    onChange={handleChange}
                    min={minDate}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="bm-form-group">
                  <label className="bm-label">
                    <i className="bi bi-clock"></i>
                    Preferred Time <span className="bm-required">*</span>
                  </label>
                  <input
                    type="time"
                    className="bm-input"
                    name="scheduled_time"
                    value={formData.scheduled_time}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Location with Map */}
              <div className="bm-form-group">
                <label className="bm-label">
                  <i className="bi bi-geo-alt"></i>
                  Service Location <span className="bm-required">*</span>
                </label>
                <div className="bm-location-wrapper">
                  <input
                    type="text"
                    className="bm-input"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Enter your address or use the map"
                    required
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    className="bm-map-btn"
                    onClick={() => setShowMapModal(true)}
                    disabled={loading}
                  >
                    <i className="bi bi-map"></i>
                    <span>Use Map</span>
                  </button>
                </div>
                <small className="bm-hint">
                  <i className="bi bi-info-circle"></i>
                  Click "Use Map" to select your exact location
                </small>
              </div>

              {/* Info Alert */}
              <div className="bm-info-alert">
                <i className="bi bi-info-circle"></i>
                <p>
                  The provider will contact you to confirm the booking details and final price.
                  You can chat with them once the booking is accepted.
                </p>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="bm-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="bm-spinner"></span>
                    Sending Request...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send"></i>
                    Send Booking Request
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <LocationPickerModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          onSelectLocation={handleLocationSelect}
          initialPosition={formData.latitude && formData.longitude ? {
            lat: formData.latitude,
            lng: formData.longitude
          } : null}
        />
      )}
    </div>
  )
}

export default BookingModal