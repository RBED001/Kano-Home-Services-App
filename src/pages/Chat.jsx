import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabaseClient'
import '../styles/Chat.css'

function Chat() {
  const { bookingId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  
  // State
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [booking, setBooking] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
  // Refs
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    fetchBookingDetails()
  }, [bookingId])

  useEffect(() => {
    if (booking && otherUser) {
      fetchMessages()
      const unsubscribe = subscribeToMessages()
      const typingUnsubscribe = subscribeToTypingStatus()
      
      return () => {
        unsubscribe()
        typingUnsubscribe()
      }
    }
  }, [booking, otherUser])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Scroll event handler
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom)
      
      // Mark messages as read when scrolled to bottom
      if (isNearBottom && unreadCount > 0) {
        markMessagesAsRead()
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [unreadCount])

  const fetchBookingDetails = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()

      if (bookingError) {
        console.error('Booking error:', bookingError)
        alert('Booking not found')
        navigate(-1)
        return
      }

      // Check access
      const isCustomer = user.id === bookingData.customer_id
      
      const { data: providerData } = await supabase
        .from('service_providers')
        .select('user_id, id, category_id')
        .eq('id', bookingData.provider_id)
        .single()

      const isProvider = user.id === providerData?.user_id

      if (!isCustomer && !isProvider) {
        alert('Access denied')
        navigate(-1)
        return
      }

      // Get customer details
      const { data: customerData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone')
        .eq('id', bookingData.customer_id)
        .single()

      // Get provider details
      const { data: providerProfileData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone')
        .eq('id', providerData.user_id)
        .single()

      // Get service category
      const { data: categoryData } = await supabase
        .from('service_categories')
        .select('name, icon_url')
        .eq('id', providerData.category_id)
        .single()

      setBooking({
        ...bookingData,
        customer: customerData,
        provider: {
          ...providerData,
          profiles: providerProfileData
        },
        service_categories: categoryData
      })

      // Set other user
      if (isCustomer) {
        setOtherUser({
          id: providerProfileData.id,
          full_name: providerProfileData.full_name,
          avatar_url: providerProfileData.avatar_url,
          phone: providerProfileData.phone,
          role: 'Provider'
        })
      } else {
        setOtherUser({
          id: customerData.id,
          full_name: customerData.full_name,
          avatar_url: customerData.avatar_url,
          phone: customerData.phone,
          role: 'Customer'
        })
      }

      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      alert('Error loading chat')
      navigate(-1)
    }
  }

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data)
      
      // Count unread
      const unread = data.filter(
        m => m.receiver_id === user.id && !isMessageRead(m)
      ).length
      setUnreadCount(unread)
      
      markMessagesAsRead()
    }
  }

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
          
          if (payload.new.sender_id !== user.id) {
            setUnreadCount(prev => prev + 1)
            playNotificationSound()
            
            // Auto-scroll if near bottom
            const container = messagesContainerRef.current
            if (container) {
              const { scrollTop, scrollHeight, clientHeight } = container
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
              if (isNearBottom) {
                setTimeout(() => scrollToBottom(), 100)
                markMessagesAsRead()
              }
            }
          } else {
            setTimeout(() => scrollToBottom(), 100)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload) => {
          setMessages(prev => 
            prev.map(msg => msg.id === payload.new.id ? payload.new : msg)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const subscribeToTypingStatus = () => {
    // Subscribe to typing indicator channel
    const channel = supabase
      .channel(`typing:${bookingId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user.id) {
          setIsTyping(true)
          
          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }
          
          // Hide typing indicator after 3 seconds
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false)
          }, 3000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendTypingIndicator = () => {
    supabase.channel(`typing:${bookingId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id }
    })
  }

  const markMessagesAsRead = async () => {
    try {
      // Mark as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('booking_id', bookingId)
        .eq('receiver_id', user.id)
        .eq('read', false)
      
      setUnreadCount(0)
    } catch (error) {
      console.log('Could not mark as read:', error)
    }
  }

 const sendMessage = async (e, imageUrl = null) => {
  if (e) e.preventDefault()
  
  const messageText = newMessage.trim()
  if (!messageText && !imageUrl) return
  if (sending) return

  setSending(true)
  setNewMessage('')

  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        receiver_id: otherUser.id,
        message: imageUrl || messageText,
        read: false
      })

    if (error) throw error

    playSendSound()
  } catch (error) {
    console.error('Error sending message:', error)
    alert('Failed to send message')
    setNewMessage(messageText)
  } finally {
    setSending(false)
    inputRef.current?.focus()
  }
}

  const handleImageSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewImage({
        file,
        preview: e.target.result
      })
    }
    reader.readAsDataURL(file)
  }

  const uploadAndSendImage = async () => {
    if (!previewImage) return

    setUploadingImage(true)

    try {
      const fileExt = previewImage.file.name.split('.').pop()
      const fileName = `${bookingId}/${user.id}/${Date.now()}.${fileExt}`

      // Upload to chat-images bucket
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, previewImage.file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName)

      // Send message with image URL
      await sendMessage(null, publicUrl)

      setPreviewImage(null)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to send image')
    } finally {
      setUploadingImage(false)
    }
  }

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id) // Only delete own messages

      if (error) throw error

      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete message')
    }
  }

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text)
    alert('Message copied!')
  }

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto' 
    })
  }

  const playNotificationSound = () => {
    // Simple notification sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSyBzvLZiTcIGWi77eeeTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606utoVRQKRp/g8r5sIQUsgc7y2Yk3CBlou+3nnk0QDFC')
    audio.volume = 0.3
    audio.play().catch(() => {}) // Ignore errors
  }

  const playSendSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSyBzvLZiTcIGWi77eeeTRAMUKfj8LZjHAY4ktfyy3ksBSR3x/DdkEAKFF606utoVRQKRp/g8r5sIQUsgc7y2Yk3CBlou+3nnk0QDFC')
    audio.volume = 0.2
    audio.play().catch(() => {})
  }

  const isMessageRead = (msg) => {
    return msg.read !== undefined ? msg.read : msg.is_read
  }

  const getStatusBadgeClass = (status) => {
    const badges = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      in_progress: 'status-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    }
    return badges[status] || 'status-pending'
  }

  const formatMessageDate = (date) => {
    const msgDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (msgDate.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return msgDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: msgDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  const emojis = ['👍', '❤️', '😊', '😂', '👏', '🙏', '✅', '🔥']

  if (loading) {
    return (
      <div className="chat-loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading conversation...</p>
      </div>
    )
  }

  if (!booking || !otherUser) {
    return (
      <div className="chat-error-screen">
        <i className="bi bi-exclamation-triangle"></i>
        <h3>Unable to load chat</h3>
        <p>This conversation may not exist or you don't have access</p>
        <button className="btn btn-gradient" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2"></i>
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        
        {/* Chat Header */}
        <div className="chat-header">
          <button 
            className="chat-back-btn"
            onClick={() => navigate(-1)}
          >
            <i className="bi bi-arrow-left"></i>
          </button>

          <div className="chat-user-section">
            <div className="chat-avatar-wrapper">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt={otherUser.full_name} />
              ) : (
                <div className="chat-avatar-placeholder">
                  {otherUser.full_name.charAt(0)}
                </div>
              )}
              <span className="online-status"></span>
            </div>
            <div className="chat-user-info">
              <h6>{otherUser.full_name}</h6>
              <span className="user-role-text">{otherUser.role}</span>
            </div>
          </div>

          <div className="chat-header-actions">
            {otherUser.phone && (
              <a 
                href={`tel:${otherUser.phone}`}
                className="header-action-btn"
                title="Call"
              >
                <i className="bi bi-telephone"></i>
              </a>
            )}
            <button className="header-action-btn" title="Info">
              <i className="bi bi-info-circle"></i>
            </button>
          </div>
        </div>

        {/* Booking Info Banner */}
        <div className="booking-info-banner">
          <div className="banner-icon">
            <i className="bi bi-briefcase"></i>
          </div>
          <div className="banner-content">
            <h6>{booking.service_categories?.name || 'Service Booking'}</h6>
            <div className="banner-meta">
              <span>
                <i className="bi bi-calendar3"></i>
                {new Date(booking.scheduled_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
              <span>
                <i className="bi bi-clock"></i>
                {booking.scheduled_time}
              </span>
              <span className={`status-badge ${getStatusBadgeClass(booking.status)}`}>
                {booking.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <code className="booking-id">#{bookingId.substring(0, 8)}</code>
        </div>

        {/* Messages Area */}
        <div className="chat-messages" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <div className="empty-icon">
                <i className="bi bi-chat-dots"></i>
              </div>
              <h5>No messages yet</h5>
              <p>Start the conversation with {otherUser.full_name}</p>
              <div className="quick-replies">
                <button 
                  className="quick-reply-btn"
                  onClick={() => {
                    setNewMessage("Hello! 👋")
                    inputRef.current?.focus()
                  }}
                >
                  👋 Say Hello
                </button>
                <button 
                  className="quick-reply-btn"
                  onClick={() => {
                    setNewMessage("When can you start?")
                    inputRef.current?.focus()
                  }}
                >
                  📅 Ask about schedule
                </button>
                <button 
                  className="quick-reply-btn"
                  onClick={() => {
                    setNewMessage("What's included in the service?")
                    inputRef.current?.focus()
                  }}
                >
                  ❓ Ask about service
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isOwnMessage = msg.sender_id === user.id
                const showDateDivider = index === 0 || 
                  new Date(messages[index - 1].created_at).toDateString() !== 
                  new Date(msg.created_at).toDateString()
                
                const showAvatar = !isOwnMessage && (
                  index === messages.length - 1 ||
                  messages[index + 1]?.sender_id !== msg.sender_id
                )

               const isImage = msg.message && (
  msg.message.startsWith('http') && (
    msg.message.includes('.jpg') || 
    msg.message.includes('.jpeg') || 
    msg.message.includes('.png') || 
    msg.message.includes('.gif') ||
    msg.message.includes('.webp') ||
    msg.message.includes('/chat-images/') ||
    msg.message.includes('/storage/v1/')
  )
)

                return (
                  <div key={msg.id}>
                    {showDateDivider && (
                      <div className="date-divider">
                        <span>{formatMessageDate(msg.created_at)}</span>
                      </div>
                    )}
                    
                    <div className={`message-row ${isOwnMessage ? 'message-sent' : 'message-received'}`}>
                      {!isOwnMessage && (
                        <div className="message-avatar">
                          {showAvatar && (
                            otherUser.avatar_url ? (
                              <img src={otherUser.avatar_url} alt="" />
                            ) : (
                              <div className="message-avatar-small">
                                {otherUser.full_name.charAt(0)}
                              </div>
                            )
                          )}
                        </div>
                      )}
                      
                      <div className="message-content">
                        <div 
                          className={`message-bubble ${isOwnMessage ? 'bubble-own' : 'bubble-other'}`}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setSelectedMessage(msg)
                          }}
                        >
                          {isImage ? (
                            <div className="message-image">
                              <img 
                                src={msg.message} 
                                alt="Shared image"
                                onClick={() => window.open(msg.message, '_blank')}
                              />
                            </div>
                          ) : (
                            <p className="message-text">{msg.message}</p>
                          )}
                          
                          <div className="message-footer">
                            <span className="message-time">
                              {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                            {isOwnMessage && (
                              <span className="message-status">
                                {isMessageRead(msg) ? (
                                  <i className="bi bi-check-all text-primary"></i>
                                ) : (
                                  <i className="bi bi-check-all"></i>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Message actions menu */}
                        {selectedMessage?.id === msg.id && (
                          <div className="message-actions-menu">
                            <button onClick={() => copyMessage(msg.message)}>
                              <i className="bi bi-clipboard"></i>
                              Copy
                            </button>
                            {isOwnMessage && (
                              <button 
                                onClick={() => {
                                  deleteMessage(msg.id)
                                  setSelectedMessage(null)
                                }}
                                className="text-danger"
                              >
                                <i className="bi bi-trash"></i>
                                Delete
                              </button>
                            )}
                            <button onClick={() => setSelectedMessage(null)}>
                              <i className="bi bi-x"></i>
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="message-row message-received">
                  <div className="message-avatar">
                    {otherUser.avatar_url ? (
                      <img src={otherUser.avatar_url} alt="" />
                    ) : (
                      <div className="message-avatar-small">
                        {otherUser.full_name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button 
            className="scroll-to-bottom"
            onClick={() => scrollToBottom()}
          >
            <i className="bi bi-arrow-down"></i>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </button>
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <div className="image-preview-modal">
            <div className="preview-overlay" onClick={() => setPreviewImage(null)}></div>
            <div className="preview-content">
              <button 
                className="preview-close"
                onClick={() => setPreviewImage(null)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
              <img src={previewImage.preview} alt="Preview" />
              <div className="preview-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setPreviewImage(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-gradient"
                  onClick={uploadAndSendImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send me-2"></i>
                      Send Image
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            <div className="emoji-grid">
              {emojis.map((emoji, i) => (
                <button
                  key={i}
                  className="emoji-btn"
                  onClick={() => {
                    setNewMessage(prev => prev + emoji)
                    setShowEmojiPicker(false)
                    inputRef.current?.focus()
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="chat-input-area">
          <form onSubmit={sendMessage} className="chat-input-form">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            
            <button 
              type="button" 
              className="input-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Send image"
            >
              <i className="bi bi-image"></i>
            </button>
            
            <div className="chat-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="message-input"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  sendTypingIndicator()
                }}
                disabled={sending}
                autoFocus
              />
              <button 
                type="button" 
                className="emoji-toggle-btn"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <i className="bi bi-emoji-smile"></i>
              </button>
            </div>

            <button 
              type="submit" 
              className={`send-btn ${newMessage.trim() ? 'active' : ''}`}
              disabled={sending || !newMessage.trim()}
            >
              {sending ? (
                <div className="spinner-small"></div>
              ) : (
                <i className="bi bi-send-fill"></i>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Chat