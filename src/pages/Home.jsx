import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabaseClient'
import Footer from '../components/Footer'
import '../styles/Home.css'  

function Home() {
  useEffect(() => {
  document.body.classList.add('home-page')
  return () => {
    document.body.classList.remove('home-page')
  }
}, [])
  const { user, profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState({
    providers: 0,
    customers: 0,
    bookings: 0
  })
  const [displayStats, setDisplayStats] = useState({
    providers: 0,
    customers: 0,
    bookings: 0
  })

  useEffect(() => {
    fetchCategories()
    fetchStats()
  }, [])

  // Animated counter effect
  useEffect(() => {
    if (stats.providers === 0 && stats.customers === 0 && stats.bookings === 0) return

    const duration = 2000 // 2 seconds
    const steps = 60
    const stepDuration = duration / steps

    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps

      setDisplayStats({
        providers: Math.floor(stats.providers * progress),
        customers: Math.floor(stats.customers * progress),
        bookings: Math.floor(stats.bookings * progress)
      })

      if (currentStep >= steps) {
        setDisplayStats(stats)
        clearInterval(interval)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [stats])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('service_categories')
      .select('*')
      .order('name')
    if (data) setCategories(data)
  }

  const fetchStats = async () => {
    const { count: providersCount } = await supabase
      .from('service_providers')
      .select('*', { count: 'exact', head: true })

    const { count: customersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer')

    const { count: bookingsCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    setStats({
      providers: providersCount || 0,
      customers: customersCount || 0,
      bookings: bookingsCount || 0
    })
  }

  const getCategoryIcon = (name) => {
    const icons = {
      'Electrician': 'bi-lightning-charge-fill',
      'Plumber': 'bi-wrench-adjustable',
      'Carpenter': 'bi-hammer',
      'Painter': 'bi-palette-fill',
      'Cleaner': 'bi-wind',
      'AC Technician': 'bi-fan',
      'Generator Technician': 'bi-gear-fill',
      'Tiler': 'bi-bricks'
    }
    return icons[name] || 'bi-tools'
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 hero-content">
              <h1 className="hero-title animate-fadeInUp">
                Find Trusted Home Service Providers in <span className="text-warning">Kano</span>
              </h1>
              <p className="hero-subtitle animate-fadeInUp stagger-1">
                Connect with verified electricians, plumbers, carpenters, and more. 
                Book services easily and get quality work done right at your doorstep.
              </p>
              <div className="d-flex gap-3 flex-wrap animate-fadeInUp stagger-2">
                {!user ? (
                  <>
                    <Link to="/providers" className="btn btn-white btn-lg">
                      <i className="bi bi-search me-2"></i>Find Services
                    </Link>
                    <Link to="/register" className="btn btn-outline-light btn-lg">
                      <i className="bi bi-person-plus me-2"></i>Join Now
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/dashboard" className="btn btn-white btn-lg">
                      <i className="bi bi-search me-2"></i>Browse Services
                    </Link>
                    <Link to="/dashboard" className="btn btn-outline-light btn-lg">
                      <i className="bi bi-grid me-2"></i>Dashboard
                    </Link>
                  </>
                )}
              </div>
              
              {/* Trust Badges */}
              <div className="mt-5 d-flex align-items-center gap-4 flex-wrap">
                <div className="d-flex align-items-center gap-2 text-white animate-fadeInUp stagger-3">
                  <i className="bi bi-shield-check"></i>
                  <span>Verified Providers</span>
                </div>
                <div className="d-flex align-items-center gap-2 text-white animate-fadeInUp stagger-4">
                  <i className="bi bi-star-fill"></i>
                  <span>Quality Service</span>
                </div>
                <div className="d-flex align-items-center gap-2 text-white animate-fadeInUp stagger-5">
                  <i className="bi bi-clock"></i>
                  <span>24/7 Support</span>
                </div>
              </div>
            </div>
            <div className="col-lg-6 d-none d-lg-block text-center">
              <div className="hero-image animate-fadeInRight animate-float">
                <i className="bi bi-house-gear-fill text-white" style={{ fontSize: '20rem', opacity: 0.15 }}></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="row">
            <div className="col-md-4 mb-4 mb-md-0">
              <div className="stat-item animate-scaleIn stagger-1">
                <div className="stat-number">{displayStats.providers}+</div>
                <div className="stat-label">Verified Service Providers</div>
              </div>
            </div>
            <div className="col-md-4 mb-4 mb-md-0">
              <div className="stat-item animate-scaleIn stagger-2">
                <div className="stat-number">{displayStats.customers}+</div>
                <div className="stat-label">Happy Customers</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="stat-item animate-scaleIn stagger-3">
                <div className="stat-number">{displayStats.bookings}+</div>
                <div className="stat-label">Jobs Completed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="section bg-white" id="services">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title section-title-center section-title-underline animate-fadeInUp">
              Our Services
            </h2>
            <p className="section-subtitle animate-fadeInUp stagger-1">
              Find the right professional for any home service need
            </p>
          </div>
          <div className="row g-4">
            {categories.map((category, index) => (
              <div key={category.id} className="col-6 col-md-4 col-lg-3">
                <Link to="/providers" style={{ textDecoration: 'none' }}>
                  <div className={`category-card animate-fadeInUp stagger-${Math.min(index + 1, 5)}`}>
                    <div className="category-icon">
                      <i className={`bi ${getCategoryIcon(category.name)}`}></i>
                    </div>
                    <div className="category-name">{category.name}</div>
                    {category.description && (
                      <small className="text-muted d-block mt-1">{category.description}</small>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-5 animate-fadeInUp">
            <Link to="/providers" className="btn btn-gradient btn-lg">
              View All Services <i className="bi bi-arrow-right ms-2"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)' }} id="how-it-works">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title section-title-center section-title-underline animate-fadeInUp">
              How It Works
            </h2>
            <p className="section-subtitle animate-fadeInUp stagger-1">
              Get your home services done in 4 easy steps
            </p>
          </div>
          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="step-card animate-fadeInUp stagger-1">
                <div className="step-number">1</div>
                <div className="step-connector d-none d-lg-block"></div>
                <i className="bi bi-search fs-1 text-primary mb-3 d-block"></i>
                <h5>Search Service</h5>
                <p className="text-muted">Browse through our verified service providers</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="step-card animate-fadeInUp stagger-2">
                <div className="step-number">2</div>
                <div className="step-connector d-none d-lg-block"></div>
                <i className="bi bi-person-check-fill fs-1 text-primary mb-3 d-block"></i>
                <h5>Choose Provider</h5>
                <p className="text-muted">Compare ratings, reviews and prices</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="step-card animate-fadeInUp stagger-3">
                <div className="step-number">3</div>
                <div className="step-connector d-none d-lg-block"></div>
                <i className="bi bi-calendar-check-fill fs-1 text-primary mb-3 d-block"></i>
                <h5>Book Service</h5>
                <p className="text-muted">Schedule at your convenient time</p>
              </div>
            </div>
            <div className="col-md-6 col-lg-3">
              <div className="step-card animate-fadeInUp stagger-4">
                <div className="step-number">4</div>
                <i className="bi bi-check-circle-fill fs-1 text-primary mb-3 d-block"></i>
                <h5>Get It Done</h5>
                <p className="text-muted">Relax while professionals handle the job</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features/Why Choose Us */}
      <section className="section bg-white" id="features">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title section-title-center section-title-underline animate-fadeInUp">
              Why Choose KHSA
            </h2>
            <p className="section-subtitle animate-fadeInUp stagger-1">
              We make hiring home service providers simple, safe, and reliable
            </p>
          </div>
          <div className="row g-4">
            <div className="col-md-6 col-lg-4">
              <div className="feature-card animate-fadeInUp stagger-1">
                <div className="feature-icon">
                  <i className="bi bi-shield-check"></i>
                </div>
                <h4 className="feature-title">Verified Professionals</h4>
                <p className="feature-text">
                  All our service providers go through a verification process to ensure quality and reliability.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="feature-card animate-fadeInUp stagger-2">
                <div className="feature-icon">
                  <i className="bi bi-cash-stack"></i>
                </div>
                <h4 className="feature-title">Transparent Pricing</h4>
                <p className="feature-text">
                  Compare prices upfront. No hidden charges. You know what you pay before booking.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="feature-card animate-fadeInUp stagger-3">
                <div className="feature-icon">
                  <i className="bi bi-chat-dots"></i>
                </div>
                <h4 className="feature-title">Real-time Chat</h4>
                <p className="feature-text">
                  Communicate directly with service providers to discuss your needs before and during the job.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="feature-card animate-fadeInUp stagger-4">
                <div className="feature-icon">
                  <i className="bi bi-geo-alt-fill"></i>
                </div>
                <h4 className="feature-title">Local Experts</h4>
                <p className="feature-text">
                  Find skilled professionals right in your neighborhood across Kano State.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="feature-card animate-fadeInUp stagger-5">
                <div className="feature-icon">
                  <i className="bi bi-star-fill"></i>
                </div>
                <h4 className="feature-title">Ratings & Reviews</h4>
                <p className="feature-text">
                  Make informed decisions based on genuine reviews from other customers.
                </p>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="feature-card animate-fadeInUp stagger-5">
                <div className="feature-icon">
                  <i className="bi bi-phone-fill"></i>
                </div>
                <h4 className="feature-title">Mobile Friendly</h4>
                <p className="feature-text">
                  Book services on the go. Our PWA works seamlessly on any device.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section" style={{ background: 'var(--gradient-hero)' }} id="testimonials">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title section-title-center section-title-underline text-white animate-fadeInUp">
              What Our Customers Say
            </h2>
            <p className="section-subtitle text-white animate-fadeInUp stagger-1" style={{ opacity: 0.95 }}>
              Real stories from satisfied customers
            </p>
          </div>
          <div className="row g-4">
            <div className="col-md-6 col-lg-4">
              <div className="testimonial-card animate-fadeInUp stagger-1">
                <p className="testimonial-text">
                  "Found an excellent electrician within minutes. The service was professional and the pricing was fair. Highly recommend KHSA!"
                </p>
                <div className="testimonial-author">
                  <div className="provider-avatar-placeholder">
                    A
                  </div>
                  <div>
                    <strong>Aminu Ibrahim</strong>
                    <div className="text-muted small">
                      <i className="bi bi-geo-alt me-1"></i>Kano City
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="testimonial-card animate-fadeInUp stagger-2">
                <p className="testimonial-text">
                  "As a plumber, this platform has helped me get more customers. The booking system is easy to use and reliable."
                </p>
                <div className="testimonial-author">
                  <div className="provider-avatar-placeholder">
                    M
                  </div>
                  <div>
                    <strong>Musa Abdullahi</strong>
                    <div className="text-muted small">
                      <i className="bi bi-wrench me-1"></i>Service Provider
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6 col-lg-4">
              <div className="testimonial-card animate-fadeInUp stagger-3">
                <p className="testimonial-text">
                  "The chat feature made it so easy to explain my AC problem. The technician arrived on time and fixed it perfectly!"
                </p>
                <div className="testimonial-author">
                  <div className="provider-avatar-placeholder">
                    F
                  </div>
                  <div>
                    <strong>Fatima Yusuf</strong>
                    <div className="text-muted small">
                      <i className="bi bi-geo-alt me-1"></i>Nasarawa GRA
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="section bg-white" id="about">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 mb-4 mb-lg-0 text-center">
              <div className="animate-fadeInLeft animate-pulse">
                <i className="bi bi-people-fill text-primary" style={{ fontSize: '15rem', opacity: 0.1 }}></i>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="animate-fadeInRight">
                <h2 className="section-title section-title-underline">About KHSA</h2>
                <p className="text-muted mb-4">
                  Kano Home Services App (KHSA) is a digital marketplace designed to connect residents of Kano State with trusted home service providers.
                </p>
                <p className="text-muted mb-4">
                  We understand the challenges of finding reliable artisans through traditional methods. That's why we created a platform that makes it easy to find, compare, and book verified professionals for all your home service needs.
                </p>
                <div className="row g-3 mb-4">
                  <div className="col-6">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-check-circle-fill text-success fs-4 me-2"></i>
                      <span>Verified Providers</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-check-circle-fill text-success fs-4 me-2"></i>
                      <span>Secure Booking</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-check-circle-fill text-success fs-4 me-2"></i>
                      <span>Real-time Updates</span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-check-circle-fill text-success fs-4 me-2"></i>
                      <span>24/7 Support</span>
                    </div>
                  </div>
                </div>
                <div>
                  <Link to="/register" className="btn btn-gradient btn-lg">
                    Get Started <i className="bi bi-arrow-right ms-2"></i>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="animate-fadeInUp">
            <h2 className="cta-title">Ready to Get Started?</h2>
            <p className="cta-text">
              Join {displayStats.customers + displayStats.providers}+ satisfied users on KHSA
            </p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <Link to="/register" className="btn btn-white btn-lg">
                <i className="bi bi-person-plus me-2"></i>Sign Up Now
              </Link>
              <Link to="/providers" className="btn btn-outline-light btn-lg">
                <i className="bi bi-search me-2"></i>Find Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default Home