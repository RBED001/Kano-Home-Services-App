import { useState, useEffect } from 'react'
import '../styles/InstallPWA.css'

function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(isIOSDevice)

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App already installed')
      return
    }

    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Save the event so it can be triggered later
      setDeferredPrompt(e)
      // Show install prompt after 30 seconds or on scroll
      setTimeout(() => {
        setShowInstallPrompt(true)
      }, 30000) // Show after 30 seconds
    }

    // Also show on scroll (after user engagement)
    const scrollHandler = () => {
      if (window.scrollY > 500 && deferredPrompt) {
        setShowInstallPrompt(true)
        window.removeEventListener('scroll', scrollHandler)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('scroll', scrollHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('scroll', scrollHandler)
    }
  }, [deferredPrompt])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
      // Track analytics event
      if (window.gtag) {
        window.gtag('event', 'pwa_install', { method: 'prompt' })
      }
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleClose = () => {
    setShowInstallPrompt(false)
    // Don't show again for 7 days
    localStorage.setItem('pwaPromptDismissed', Date.now())
  }

  // Check if we should show based on previous dismissal
  useEffect(() => {
    const dismissedTime = localStorage.getItem('pwaPromptDismissed')
    if (dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissed < 7) {
        setShowInstallPrompt(false)
      }
    }
  }, [])

  // Don't show if already dismissed recently
  if (!showInstallPrompt) return null

  // iOS needs manual installation
  if (isIOS) {
    return (
      <div className="install-prompt-container">
        <div className="install-prompt animate-slideUp">
          <button className="close-button" onClick={handleClose}>
            <i className="bi bi-x-lg"></i>
          </button>
          
          <div className="install-content">
            <div className="install-icon-wrapper">
              <i className="bi bi-app-indicator"></i>
            </div>
            
            <div className="install-text">
              <h3>Install KHSA App</h3>
              <p>
                Tap <i className="bi bi-box-arrow-up"></i> then "Add to Home Screen"
              </p>
            </div>
          </div>

          <div className="install-benefits">
            <div className="benefit">
              <i className="bi bi-lightning-fill"></i>
              <span>Faster</span>
            </div>
            <div className="benefit">
              <i className="bi bi-wifi-off"></i>
              <span>Works Offline</span>
            </div>
            <div className="benefit">
              <i className="bi bi-bell-fill"></i>
              <span>Notifications</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Android/Desktop installation
  return (
    <div className="install-prompt-container">
      <div className="install-prompt animate-slideUp">
        <button className="close-button" onClick={handleClose}>
          <i className="bi bi-x-lg"></i>
        </button>
        
        <div className="install-content">
          <div className="install-icon-wrapper">
            <i className="bi bi-house-gear"></i>
          </div>
          
          <div className="install-text">
            <h3>Install KHSA App</h3>
            <p>Get the full experience with our app!</p>
          </div>

          <div className="install-buttons">
            <button 
              className="btn-install-now"
              onClick={handleInstallClick}
            >
              <i className="bi bi-download"></i>
              Install Now
            </button>
            <button 
              className="btn-maybe-later"
              onClick={handleClose}
            >
              Maybe Later
            </button>
          </div>
        </div>

        <div className="install-benefits">
          <div className="benefit">
            <i className="bi bi-lightning-fill"></i>
            <span>Faster</span>
          </div>
          <div className="benefit">
            <i className="bi bi-wifi-off"></i>
            <span>Works Offline</span>
          </div>
          <div className="benefit">
            <i className="bi bi-bell-fill"></i>
            <span>Notifications</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InstallPWA