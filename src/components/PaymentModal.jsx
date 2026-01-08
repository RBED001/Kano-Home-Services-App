import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabaseClient'
import '../styles/PaymentModal.css'

function PaymentModal({ booking, onClose, onSuccess }) {
  const { user } = useAuth()
  
  /* ===== STATE MANAGEMENT ===== */
  const [paymentMethod, setPaymentMethod] = useState(null) // 'online' or 'offline'
  const [loading, setLoading] = useState(false)
  const [offlineConfirmed, setOfflineConfirmed] = useState(false)
  const [customAmount, setCustomAmount] = useState('') // Custom amount input
  const [amountError, setAmountError] = useState('') // Amount validation error

  /* ===== CALCULATE PAYMENT AMOUNTS ===== */
  // Use custom amount if provided, otherwise use booking price or hourly rate
  const baseAmount = booking.price || booking.service_providers?.hourly_rate || 0
  const serviceAmount = customAmount ? parseFloat(customAmount) : baseAmount
  
  // Only calculate service fee for ONLINE payments
  const serviceFee = paymentMethod === 'online' ? Math.round(serviceAmount * 0.05) : 0
  const totalAmount = serviceAmount + serviceFee

  /* ===== VALIDATE AMOUNT INPUT ===== */
  const validateAmount = (amount) => {
    const numAmount = parseFloat(amount)
    
    if (!amount || amount.trim() === '') {
      setAmountError('Please enter an amount')
      return false
    }
    
    if (isNaN(numAmount)) {
      setAmountError('Please enter a valid number')
      return false
    }
    
    if (numAmount <= 0) {
      setAmountError('Amount must be greater than zero')
      return false
    }
    
    if (numAmount < 100) {
      setAmountError('Minimum amount is ₦100')
      return false
    }
    
    if (numAmount > 10000000) {
      setAmountError('Maximum amount is ₦10,000,000')
      return false
    }
    
    setAmountError('')
    return true
  }

  /* ===== HANDLE AMOUNT INPUT CHANGE ===== */
  const handleAmountChange = (e) => {
    const value = e.target.value
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value)
      if (value) {
        validateAmount(value)
      } else {
        setAmountError('')
      }
    }
  }

  /* ===== LOAD PAYSTACK SCRIPT DYNAMICALLY ===== */
  const loadPaystackScript = () => {
    return new Promise((resolve) => {
      if (window.PaystackPop) {
        resolve(true)
        return
      }
      
      const script = document.createElement('script')
      script.src = 'https://js.paystack.co/v1/inline.js'
      script.async = true
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  /* ===== VERIFY PAYMENT TRANSACTION ===== */
  const verifyTransaction = async (reference) => {
    try {
      await supabase
        .from('transactions')
        .update({
          payment_status: 'success',
          paid_at: new Date().toISOString()
        })
        .eq('payment_reference', reference)

      await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_method: 'online',
          payment_amount: totalAmount,
          payment_reference: reference,
          paid_at: new Date().toISOString()
        })
        .eq('id', booking.id)

      setLoading(false)
      onSuccess?.('online')
    } catch (error) {
      console.error('Verification error:', error)
      alert('Payment successful but verification failed. Please contact support.')
      setLoading(false)
    }
  }

  /* ===== HANDLE ONLINE PAYMENT WITH PAYSTACK ===== */
  const handleOnlinePayment = async () => {
    // Validate amount before proceeding
    if (!validateAmount(customAmount || baseAmount.toString())) {
      return
    }

    setLoading(true)

    const isScriptLoaded = await loadPaystackScript()
    if (!isScriptLoaded) {
      alert('Failed to load payment gateway. Please check your internet connection.')
      setLoading(false)
      return
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
    if (!publicKey) {
      alert('Paystack API key not configured.')
      setLoading(false)
      return
    }

    const reference = `KHSA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          booking_id: booking.id,
          customer_id: user.id,
          provider_id: booking.provider_id,
          amount: serviceAmount,
          service_fee: serviceFee,
          total_amount: totalAmount,
          payment_reference: reference,
          payment_status: 'pending',
          payment_method: 'online'
        })

      if (error) throw error

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: user.email,
        amount: totalAmount * 100,
        currency: 'NGN',
        ref: reference,
        metadata: {
          booking_id: booking.id,
          customer_name: user.user_metadata?.full_name || user.email
        },
        callback: function(response) {
          verifyTransaction(response.reference)
        },
        onClose: function() {
          setLoading(false)
        }
      })

      handler.openIframe()

    } catch (error) {
      console.error('Payment initialization error:', error)
      alert('Error initializing payment: ' + error.message)
      setLoading(false)
    }
  }

  /* ===== HANDLE OFFLINE PAYMENT ===== */
  const handleOfflinePayment = async () => {
    // Validate amount before proceeding
    if (!validateAmount(customAmount || baseAmount.toString())) {
      return
    }

    setLoading(true)

    try {
      await supabase
        .from('bookings')
        .update({
          payment_status: 'pending_confirmation',
          payment_method: 'offline',
          payment_amount: serviceAmount // No fee for offline
        })
        .eq('id', booking.id)

      setLoading(false)
      setOfflineConfirmed(true)
    } catch (error) {
      console.error('Error:', error)
      alert('Error processing offline payment')
      setLoading(false)
    }
  }

  /* ===== RENDER COMPONENT ===== */
  return (
    <div className="payment-modal-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button 
          className="payment-modal-close" 
          onClick={onClose} 
          aria-label="Close payment modal"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        {/* SECTION 1: Offline Confirmation Screen */}
        {offlineConfirmed ? (
          <div className="payment-confirmed-screen animate-fadeInUp">
            <div className="confirmed-icon">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            
            <h3>Offline Payment Selected</h3>
            <p>Please pay the service provider directly:</p>
            
            <div className="payment-details-box">
              <div className="provider-payment-info">
                {booking.service_providers?.profiles?.avatar_url ? (
                  <img 
                    src={booking.service_providers.profiles.avatar_url} 
                    alt={booking.service_providers.profiles.full_name}
                    className="provider-avatar-small"
                  />
                ) : (
                  <div className="provider-avatar-placeholder-small">
                    {booking.service_providers?.profiles?.full_name?.charAt(0) || 'P'}
                  </div>
                )}
                
                <div>
                  <h5>{booking.service_providers?.profiles?.full_name}</h5>
                  <p>Amount: <strong>₦{serviceAmount.toLocaleString()}</strong></p>
                </div>
              </div>
            </div>

            <div className="payment-note-box">
              <i className="bi bi-info-circle"></i>
              <p>The provider will confirm receipt of payment. Your booking will be marked as paid once confirmed.</p>
            </div>

            <button className="btn-done" onClick={() => onSuccess?.('offline')}>
              <i className="bi bi-check-circle me-2"></i>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* SECTION 2: Payment Modal Header */}
            <div className="payment-modal-header">
              <div className="payment-icon">
                <i className="bi bi-credit-card-2-front"></i>
              </div>
              
              <h3>Complete Payment</h3>
              <p>Choose how you'd like to pay for this service</p>
            </div>

            {/* SECTION 3: Service Summary */}
            <div className="service-summary">
              <div className="service-info">
                <i className={`bi ${booking.service_categories?.icon || 'bi-briefcase'}`}></i>
                
                <div>
                  <h5>{booking.service_categories?.name || 'Service'}</h5>
                  <span>by {booking.service_providers?.profiles?.full_name}</span>
                </div>
              </div>
            </div>

            {/* AMOUNT INPUT SECTION */}
            <div className="amount-input-section">
              <label htmlFor="payment-amount" className="amount-label">
                <i className="bi bi-currency-exchange me-2"></i>
                Payment Amount
              </label>
              
              <div className="amount-input-wrapper">
                <span className="currency-symbol">₦</span>
                <input
                  id="payment-amount"
                  type="text"
                  className={`amount-input ${amountError ? 'error' : ''}`}
                  placeholder="0.00"
                  value={customAmount}
                  onChange={handleAmountChange}
                  disabled={loading}
                />
              </div>

              {/* Show default amount if no custom amount */}
              {!customAmount && baseAmount > 0 && (
                <p className="amount-hint">
                  <i className="bi bi-info-circle me-1"></i>
                  Default amount: ₦{baseAmount.toLocaleString()}
                </p>
              )}

              {/* Show error message */}
              {amountError && (
                <p className="amount-error">
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {amountError}
                </p>
              )}

              {/* Show calculated totals - dynamically based on payment method */}
              {customAmount && !amountError && parseFloat(customAmount) > 0 && (
                <div className="amount-preview">
                  <div className="preview-item">
                    <span>Service Amount:</span>
                    <strong>₦{serviceAmount.toLocaleString()}</strong>
                  </div>
                  
                  {paymentMethod === 'online' && (
                    <>
                      <div className="preview-item">
                        <span>Platform Fee (5%):</span>
                        <strong>₦{serviceFee.toLocaleString()}</strong>
                      </div>
                      <div className="preview-item total">
                        <span>Total (Online):</span>
                        <strong>₦{totalAmount.toLocaleString()}</strong>
                      </div>
                    </>
                  )}
                  
                  {paymentMethod === 'offline' && (
                    <div className="preview-item total">
                      <span>Total (Offline):</span>
                      <strong>₦{serviceAmount.toLocaleString()}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 4: Payment Method Selection */}
            {!paymentMethod ? (
              <div className="payment-methods">
                <h5>Select Payment Method</h5>
                
                {/* Online Payment Card */}
                <div 
                  className="payment-method-card animate-fadeInUp"
                  onClick={() => {
                    if (customAmount && validateAmount(customAmount)) {
                      setPaymentMethod('online')
                    } else if (!customAmount && baseAmount > 0) {
                      setCustomAmount(baseAmount.toString())
                      setPaymentMethod('online')
                    } else {
                      setAmountError('Please enter a valid amount')
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="method-icon online">
                    <i className="bi bi-credit-card"></i>
                  </div>
                  
                  <div className="method-details">
                    <h6>Pay Online</h6>
                    <p>Card, Bank Transfer, USSD</p>
                  </div>
                  
                  <div className="method-amount">
                    <span className="amount">
                      ₦{(serviceAmount + Math.round(serviceAmount * 0.05)).toLocaleString()}
                    </span>
                    <small>Includes 5% fee</small>
                  </div>
                  
                  <i className="bi bi-chevron-right"></i>
                </div>

                {/* Offline Payment Card */}
                <div 
                  className="payment-method-card animate-fadeInUp stagger-1"
                  onClick={() => {
                    if (customAmount && validateAmount(customAmount)) {
                      setPaymentMethod('offline')
                    } else if (!customAmount && baseAmount > 0) {
                      setCustomAmount(baseAmount.toString())
                      setPaymentMethod('offline')
                    } else {
                      setAmountError('Please enter a valid amount')
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="method-icon offline">
                    <i className="bi bi-cash-stack"></i>
                  </div>
                  
                  <div className="method-details">
                    <h6>Pay Offline</h6>
                    <p>Cash or Direct Transfer</p>
                  </div>
                  
                  <div className="method-amount">
                    <span className="amount">
                      ₦{serviceAmount.toLocaleString()}
                    </span>
                    <small>No extra fee</small>
                  </div>
                  
                  <i className="bi bi-chevron-right"></i>
                </div>
              </div>
            ) : (
              <>
                {/* Back Button */}
                <button 
                  className="back-to-methods"
                  onClick={() => setPaymentMethod(null)}
                  aria-label="Go back to payment methods"
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Choose different method
                </button>

                {/* ONLINE PAYMENT DETAILS */}
                {paymentMethod === 'online' && (
                  <div className="payment-details animate-fadeInUp">
                    <h5>
                      <i className="bi bi-credit-card me-2"></i>
                      Online Payment
                    </h5>
                    
                    <div className="payment-breakdown">
                      <div className="breakdown-item">
                        <span>Service Cost</span>
                        <span>₦{serviceAmount.toLocaleString()}</span>
                      </div>
                      
                      <div className="breakdown-item fee">
                        <span>Platform Fee (5%)</span>
                        <span>₦{serviceFee.toLocaleString()}</span>
                      </div>
                      
                      <hr />
                      
                      <div className="breakdown-item total">
                        <strong>Total</strong>
                        <strong>₦{totalAmount.toLocaleString()}</strong>
                      </div>
                    </div>

                    <button
                      className="btn-pay online"
                      onClick={handleOnlinePayment}
                      disabled={loading || !!amountError}
                      aria-label={`Pay ${totalAmount.toLocaleString()} Naira online`}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-lock-fill me-2"></i>
                          Pay ₦{totalAmount.toLocaleString()}
                        </>
                      )}
                    </button>

                    <div className="payment-security">
                      <i className="bi bi-shield-check"></i>
                      <span>Secured by Paystack</span>
                    </div>
                  </div>
                )}

                {/* OFFLINE PAYMENT DETAILS */}
                {paymentMethod === 'offline' && (
                  <div className="payment-details animate-fadeInUp">
                    <h5>
                      <i className="bi bi-cash-stack me-2"></i>
                      Offline Payment
                    </h5>
                    
                    <div className="payment-breakdown">
                      <div className="breakdown-item total">
                        <strong>Amount to Pay</strong>
                        <strong>₦{serviceAmount.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="offline-info">
                      <div className="info-item">
                        <i className="bi bi-1-circle-fill"></i>
                        <span>Pay the provider directly via cash or bank transfer</span>
                      </div>
                      
                      <div className="info-item">
                        <i className="bi bi-2-circle-fill"></i>
                        <span>Provider will confirm receipt in the app</span>
                      </div>
                      
                      <div className="info-item">
                        <i className="bi bi-3-circle-fill"></i>
                        <span>Booking will be marked as paid</span>
                      </div>
                    </div>

                    <button
                      className="btn-pay offline"
                      onClick={handleOfflinePayment}
                      disabled={loading || !!amountError}
                      aria-label="Confirm offline payment"
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Confirm Offline Payment
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentModal