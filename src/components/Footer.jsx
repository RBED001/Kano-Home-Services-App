import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../styles/Footer.css'

function Footer() {
  const [showTopBtn, setShowTopBtn] = useState(false)
  const [email, setEmail] = useState('')
  const [subscribeStatus, setSubscribeStatus] = useState('')

  // Show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // Newsletter subscription
  const handleSubscribe = (e) => {
    e.preventDefault()
    if (email) {
      setSubscribeStatus('success')
      setEmail('')
      setTimeout(() => setSubscribeStatus(''), 3000)
    }
  }

  return (
    <>
      {/* Back to Top Button */}
      <button
        className={`back-to-top ${showTopBtn ? 'show' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <i className="bi bi-arrow-up"></i>
      </button>

      {/* Footer */}
      <footer className="footer">
        {/* Newsletter Section */}
        <div className="footer-newsletter">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-5">
                <h3 className="newsletter-title">
                  <i className="bi bi-envelope-heart me-2"></i>
                  Stay Updated
                </h3>
                <p className="newsletter-text">
                  Get the latest updates on new services and providers in Kano
                </p>
              </div>
              <div className="col-lg-7">
                <form className="newsletter-form" onSubmit={handleSubscribe}>
                  <div className="newsletter-input-group">
                    <input
                      type="email"
                      className="newsletter-input"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn-newsletter">
                      Subscribe
                      <i className="bi bi-send ms-2"></i>
                    </button>
                  </div>
                  {subscribeStatus === 'success' && (
                    <div className="newsletter-success">
                      <i className="bi bi-check-circle me-2"></i>
                      Thank you for subscribing!
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="footer-main">
          <div className="container">
            <div className="row g-5">
              {/* Brand Column */}
              <div className="col-lg-4">
                <div className="footer-brand-section">
                  <Link to="/" className="footer-brand">
                    <i className="bi bi-house-gear"></i>
                    <span>KHSA</span>
                  </Link>
                  <p className="footer-description">
                    Your trusted platform for connecting with verified home service providers in Kano State. 
                    Quality service, transparent pricing, and reliability at your fingertips.
                  </p>
                  
                  {/* Social Links */}
                  <div className="footer-social">
                    <h6 className="social-title">Connect With Us</h6>
                    <div className="social-links">
                      <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" 
                         className="social-link facebook" aria-label="Facebook">
                        <i className="bi bi-facebook"></i>
                      </a>
                      <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" 
                         className="social-link twitter" aria-label="Twitter">
                        <i className="bi bi-twitter-x"></i>
                      </a>
                      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" 
                         className="social-link instagram" aria-label="Instagram">
                        <i className="bi bi-instagram"></i>
                      </a>
                      <a href="https://wa.me/2348000000000" target="_blank" rel="noopener noreferrer" 
                         className="social-link whatsapp" aria-label="WhatsApp">
                        <i className="bi bi-whatsapp"></i>
                      </a>
                      <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" 
                         className="social-link linkedin" aria-label="LinkedIn">
                        <i className="bi bi-linkedin"></i>
                      </a>
                    </div>
                  </div>

                  {/* App Download (Optional) */}
                  <div className="app-download">
                    <h6 className="download-title">Download Our App</h6>
                    <div className="download-buttons">
                      <button className="btn-download">
                        <i className="bi bi-google-play"></i>
                        <div>
                          <span>Get it on</span>
                          <strong>Google Play</strong>
                        </div>
                      </button>
                      <button className="btn-download">
                        <i className="bi bi-apple"></i>
                        <div>
                          <span>Download on</span>
                          <strong>App Store</strong>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Links Columns */}
              <div className="col-6 col-md-4 col-lg-2">
                <div className="footer-column">
                  <h5 className="footer-title">
                    <span className="title-line"></span>
                    Quick Links
                  </h5>
                  <ul className="footer-links">
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/providers">Find Services</Link></li>
                    <li><a href="/#how-it-works">How It Works</a></li>
                    <li><a href="/#about">About Us</a></li>
                    <li><a href="/#testimonials">Testimonials</a></li>
                  </ul>
                </div>
              </div>

              <div className="col-6 col-md-4 col-lg-2">
                <div className="footer-column">
                  <h5 className="footer-title">
                    <span className="title-line"></span>
                    For Providers
                  </h5>
                  <ul className="footer-links">
                    <li><Link to="/register">Join as Provider</Link></li>
                    <li><Link to="/provider-guide">Provider Guide</Link></li>
                    <li><a href="/#features">Benefits</a></li>
                    <li><Link to="/provider-faq">Provider FAQ</Link></li>
                    <li><Link to="/success-stories">Success Stories</Link></li>
                  </ul>
                </div>
              </div>

              <div className="col-6 col-md-4 col-lg-2">
                <div className="footer-column">
                  <h5 className="footer-title">
                    <span className="title-line"></span>
                    Support
                  </h5>
                  <ul className="footer-links">
                    <li><Link to="/help">Help Center</Link></li>
                    <li><Link to="/contact">Contact Us</Link></li>
                    <li><Link to="/faq">FAQ</Link></li>
                    <li><Link to="/terms">Terms of Service</Link></li>
                    <li><Link to="/privacy">Privacy Policy</Link></li>
                  </ul>
                </div>
              </div>

              <div className="col-6 col-md-12 col-lg-2">
                <div className="footer-column">
                  <h5 className="footer-title">
                    <span className="title-line"></span>
                    Contact Info
                  </h5>
                  <ul className="footer-contact">
                    <li>
                      <i className="bi bi-geo-alt-fill"></i>
                      <span>Kano City, <br />Kano State, Nigeria</span>
                    </li>
                    <li>
                      <i className="bi bi-envelope-fill"></i>
                      <a href="mailto:info@khsa.com">info@khsa.com</a>
                    </li>
                    <li>
                      <i className="bi bi-phone-fill"></i>
                      <a href="tel:+2348000000000">+234 800 000 0000</a>
                    </li>
                    <li>
                      <i className="bi bi-clock-fill"></i>
                      <span>Mon - Sat: 8AM - 8PM</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-6">
                <p className="copyright">
                  © {new Date().getFullYear()} <strong>KHSA</strong> - Kano Home Services App. 
                  All rights reserved.
                </p>
              </div>
              <div className="col-md-6 text-md-end">
                <div className="footer-bottom-links">
                  <Link to="/terms">Terms</Link>
                  <Link to="/privacy">Privacy</Link>
                  <Link to="/cookies">Cookies</Link>
                  <Link to="/sitemap">Sitemap</Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Wave */}
        <div className="footer-wave">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
                  fill="url(#wave-gradient)"></path>
            <defs>
              <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255, 0, 128, 0.1)" />
                <stop offset="50%" stopColor="rgba(255, 0, 128, 0.05)" />
                <stop offset="100%" stopColor="rgba(255, 0, 128, 0.1)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </footer>
    </>
  )
}

export default Footer