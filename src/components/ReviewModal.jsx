import { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import '../styles/ReviewModal.css'

function ReviewModal({ booking, onClose, onSuccess }) {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (rating === 0) {
      alert('Please select a rating')
      return
    }

    setLoading(true)

    try {
      // Insert review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          customer_id: user.id,
          provider_id: booking.provider_id,
          rating: rating,
          comment: comment.trim() || null
        })

      if (reviewError) throw reviewError

      // Fetch ALL reviews for this provider (including the one we just added)
      const { data: allReviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('provider_id', booking.provider_id)

      if (reviewsError) throw reviewsError

      // Calculate new average rating
      if (allReviews && allReviews.length > 0) {
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0)
        const avgRating = totalRating / allReviews.length

        console.log('Total reviews:', allReviews.length)
        console.log('Average rating:', avgRating)

        // Update provider rating
        const { error: updateError } = await supabase
          .from('service_providers')
          .update({ rating: avgRating })
          .eq('id', booking.provider_id)

        if (updateError) throw updateError
      }

      setSubmitted(true)
      
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)
      
    } catch (error) {
      console.error('Error details:', error)
      alert('Error submitting review: ' + error.message)
      setLoading(false)
    }
  }

  const getRatingText = (stars) => {
    const texts = {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent'
    }
    return texts[stars] || ''
  }

  const getRatingEmoji = (stars) => {
    const emojis = {
      1: '😞',
      2: '😐',
      3: '🙂',
      4: '😊',
      5: '🤩'
    }
    return emojis[stars] || ''
  }

  return (
    <div className="review-modal-overlay" onClick={onClose}>
      <div className="review-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button 
          className="review-modal-close" 
          onClick={onClose}
          aria-label="Close review modal"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        {/* Success State */}
        {submitted ? (
          <div className="review-success animate-scaleIn">
            <div className="success-icon">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h3>Thank You!</h3>
            <p>Your review has been submitted successfully</p>
            <div className="success-rating">
              {[...Array(rating)].map((_, i) => (
                <i key={i} className="bi bi-star-fill"></i>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="review-modal-header">
              <div className="review-icon">
                <i className="bi bi-star-fill"></i>
              </div>
              <h3>Rate Your Experience</h3>
              <p>Share your feedback with the community</p>
            </div>

            {/* Provider Info */}
            <div className="review-provider-info">
              {booking.service_providers?.profiles?.avatar_url ? (
                <img 
                  src={booking.service_providers.profiles.avatar_url}
                  alt={booking.service_providers.profiles.full_name}
                  className="provider-avatar"
                />
              ) : (
                <div className="provider-avatar-placeholder">
                  {booking.service_providers?.profiles?.full_name?.charAt(0) || 'P'}
                </div>
              )}
              <div className="provider-details">
                <h5>{booking.service_providers?.profiles?.full_name}</h5>
                <span>{booking.service_categories?.name}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="review-form">
              {/* Star Rating */}
              <div className="rating-section">
                <label className="rating-label">How would you rate this service?</label>
                
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= (hoveredRating || rating) ? 'active' : ''}`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      aria-label={`Rate ${star} stars`}
                    >
                      <i className="bi bi-star-fill"></i>
                    </button>
                  ))}
                </div>

                {/* Rating Feedback */}
                {(hoveredRating || rating) > 0 && (
                  <div className="rating-feedback animate-fadeIn">
                    <span className="rating-emoji">
                      {getRatingEmoji(hoveredRating || rating)}
                    </span>
                    <span className="rating-text">
                      {getRatingText(hoveredRating || rating)}
                    </span>
                  </div>
                )}
              </div>

              {/* Comment Section */}
              <div className="comment-section">
                <label htmlFor="review-comment" className="comment-label">
                  Your Review <span className="optional-text">(Optional)</span>
                </label>
                
                <textarea
                  id="review-comment"
                  className="review-textarea"
                  rows="5"
                  placeholder="Tell us about your experience with this service provider..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength="500"
                  disabled={loading}
                ></textarea>
                
                <div className="character-count">
                  <i className="bi bi-chat-left-text me-1"></i>
                  {comment.length}/500 characters
                </div>
              </div>

              {/* Review Tips */}
              {rating > 0 && !comment && (
                <div className="review-tips animate-fadeInUp">
                  <div className="tip-icon">
                    <i className="bi bi-lightbulb"></i>
                  </div>
                  <div className="tip-content">
                    <strong>Tip:</strong> Add more details to help others make informed decisions
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-submit-review"
                disabled={loading || rating === 0}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Submitting Review...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-fill me-2"></i>
                    Submit Review
                  </>
                )}
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                className="btn-cancel-review"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ReviewModal