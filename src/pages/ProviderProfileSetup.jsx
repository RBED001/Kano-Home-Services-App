import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/ProviderSetup.css'

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom marker icon with magenta color
const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function ProviderProfileSetup() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4
  
  // Loading states
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  
  // Data states
  const [categories, setCategories] = useState([])
  const [avatarFile, setAvatarFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(profile?.avatar_url || null)
  const [portfolioFiles, setPortfolioFiles] = useState([])
  const [portfolioPreviews, setPortfolioPreviews] = useState([])
  
  // Map state
  const [mapPosition, setMapPosition] = useState({
    lat: 12.0022, // Kano default
    lng: 8.5919
  })
  const [locationSelected, setLocationSelected] = useState(false)
  
  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    
    // Step 2: Service Info
    category_id: '',
    experience_years: '',
    hourly_rate: '',
    description: '',
    skills: '',
    
    // Step 3: Location
    city: 'Kano',
    address: '',
    latitude: null,
    longitude: null
  })
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchCategories()
    checkExistingProfile()
    
    // Pre-fill name and phone from profile
    if (profile) {
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      }))
      if (profile.avatar_url) {
        setPreviewUrl(profile.avatar_url)
      }
    }
  }, [profile])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .order('name')

    if (!error && data) {
      setCategories(data)
    }
  }

  const checkExistingProfile = async () => {
    const { data } = await supabase
      .from('service_providers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      navigate('/dashboard')
    }
    setCheckingProfile(false)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    if (error) setError('')
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image size should be less than 2MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      setAvatarFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError('')
    }
  }

  const handlePortfolioChange = (e) => {
    const files = Array.from(e.target.files)
    
    if (files.length + portfolioFiles.length > 6) {
      setError('Maximum 6 portfolio images allowed')
      return
    }

    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        setError('Each image should be less than 5MB')
        return false
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select only image files')
        return false
      }
      return true
    })

    setPortfolioFiles(prev => [...prev, ...validFiles])
    setPortfolioPreviews(prev => [
      ...prev,
      ...validFiles.map(file => URL.createObjectURL(file))
    ])
    setError('')
  }

  const removePortfolioImage = (index) => {
    setPortfolioFiles(prev => prev.filter((_, i) => i !== index))
    setPortfolioPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const uploadAvatar = async () => {
    if (!avatarFile) return previewUrl

    setUploading(true)
    try {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (error) {
      console.error('Error uploading avatar:', error)
      setError('Failed to upload profile image')
      return null
    } finally {
      setUploading(false)
    }
  }

  const uploadPortfolioImages = async (providerId) => {
    const uploadedImages = []

    for (let i = 0; i < portfolioFiles.length; i++) {
      const file = portfolioFiles[i]
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('work-gallery')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('work-gallery')
          .getPublicUrl(fileName)

        uploadedImages.push({
          provider_id: providerId,
          image_url: publicUrl,
          description: '',
          display_order: i
        })
      } catch (error) {
        console.error('Error uploading portfolio image:', error)
      }
    }

    if (uploadedImages.length > 0) {
      await supabase
        .from('portfolio_images')
        .insert(uploadedImages)
    }
  }

  // Map click handler component
  function LocationMarker() {
    useMapEvents({
      click(e) {
        setMapPosition({
          lat: e.latlng.lat,
          lng: e.latlng.lng
        })
        setFormData(prev => ({
          ...prev,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        }))
        setLocationSelected(true)
      },
    })

    return mapPosition ? (
      <Marker position={[mapPosition.lat, mapPosition.lng]} icon={customIcon} />
    ) : null
  }

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setMapPosition({ lat: latitude, lng: longitude })
          setFormData(prev => ({
            ...prev,
            latitude,
            longitude
          }))
          setLocationSelected(true)
        },
        (error) => {
          console.error('Error getting location:', error)
          setError('Unable to get your location. Please select manually on the map.')
        }
      )
    } else {
      setError('Geolocation is not supported by your browser')
    }
  }

  // Validation for each step
  const validateStep = (step) => {
    setError('')
    
    switch (step) {
      case 1:
        if (!formData.full_name.trim()) {
          setError('Please enter your full name')
          return false
        }
        if (!formData.phone.trim()) {
          setError('Please enter your phone number')
          return false
        }
        if (formData.phone.length < 10) {
          setError('Please enter a valid phone number')
          return false
        }
        return true

      case 2:
        if (!formData.category_id) {
          setError('Please select a service category')
          return false
        }
        if (!formData.experience_years || formData.experience_years < 0) {
          setError('Please enter valid years of experience')
          return false
        }
        if (!formData.hourly_rate || formData.hourly_rate < 0) {
          setError('Please enter a valid hourly rate')
          return false
        }
        if (!formData.skills.trim()) {
          setError('Please enter at least one skill')
          return false
        }
        if (!formData.description.trim()) {
          setError('Please provide a description of your services')
          return false
        }
        return true

      case 3:
        if (!formData.city) {
          setError('Please select your city')
          return false
        }
        if (!formData.address.trim()) {
          setError('Please enter your address')
          return false
        }
        if (!locationSelected) {
          setError('Please select your location on the map')
          return false
        }
        return true

      case 4:
        return true // Portfolio is optional

      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Upload avatar if selected
      let avatarUrl = previewUrl
      if (avatarFile) {
        avatarUrl = await uploadAvatar()
        if (!avatarUrl && avatarFile) {
          setLoading(false)
          return
        }
      }

      // Update profiles table
      const profileUpdates = {
        full_name: formData.full_name,
        phone: formData.phone,
        city: formData.city,
        address: formData.address,
        updated_at: new Date().toISOString()
      }
      
      if (avatarUrl) {
        profileUpdates.avatar_url = avatarUrl
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)

      if (profileError) throw profileError

      // Create service provider record
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .insert({
          user_id: user.id,
          category_id: formData.category_id,
          experience_years: parseInt(formData.experience_years),
          hourly_rate: parseFloat(formData.hourly_rate),
          description: formData.description,
          skills: formData.skills.split(',').map(s => s.trim()).filter(s => s)
        })
        .select()
        .single()

      if (providerError) throw providerError

      // Upload portfolio images if any
      if (portfolioFiles.length > 0 && providerData) {
        await uploadPortfolioImages(user.id)
      }

      setSuccess('Profile created successfully! 🎉')
      
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)

    } catch (error) {
      console.error('Error creating profile:', error)
      setError(error.message || 'Error creating profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    let completed = 0
    const totalFields = 10

    if (formData.full_name) completed++
    if (formData.phone) completed++
    if (previewUrl) completed++
    if (formData.category_id) completed++
    if (formData.experience_years) completed++
    if (formData.hourly_rate) completed++
    if (formData.skills) completed++
    if (formData.description) completed++
    if (formData.address && locationSelected) completed++
    if (portfolioFiles.length > 0) completed++

    return Math.round((completed / totalFields) * 100)
  }

  if (profile?.role !== 'provider') {
    return (
      <div className="provider-setup-page">
        <div className="container">
          <div className="access-denied-card">
            <i className="bi bi-exclamation-triangle"></i>
            <h3>Access Denied</h3>
            <p>This page is only for service providers.</p>
            <button onClick={() => navigate('/')} className="btn btn-gradient">
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (checkingProfile) {
    return (
      <div className="provider-setup-page">
        <div className="loading-container">
          <div className="spinner-custom"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="provider-setup-page">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-xl-7">
            
            {/* Header */}
            <div className="setup-header animate-fadeInUp">
              <div className="setup-icon-wrapper">
                <i className="bi bi-person-badge"></i>
              </div>
              <h1>Complete Your Profile</h1>
              <p>Set up your provider profile to start receiving job requests</p>
            </div>

            {/* Progress Bar */}
            <div className="progress-container animate-fadeInUp stagger-1">
              <div className="progress-info">
                <span>Step {currentStep} of {totalSteps}</span>
                <span>{getCompletionPercentage()}% Complete</span>
              </div>
              <div className="progress-bar-wrapper">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                ></div>
              </div>
              <div className="progress-steps">
                {[
                  { num: 1, icon: 'bi-person', label: 'Basic Info' },
                  { num: 2, icon: 'bi-briefcase', label: 'Services' },
                  { num: 3, icon: 'bi-geo-alt', label: 'Location' },
                  { num: 4, icon: 'bi-images', label: 'Portfolio' }
                ].map((step) => (
                  <div 
                    key={step.num}
                    className={`progress-step ${currentStep >= step.num ? 'active' : ''} ${currentStep > step.num ? 'completed' : ''}`}
                  >
                    <div className="step-circle">
                      {currentStep > step.num ? (
                        <i className="bi bi-check"></i>
                      ) : (
                        <i className={`bi ${step.icon}`}></i>
                      )}
                    </div>
                    <span className="step-label">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="alert-custom alert-error animate-fadeIn">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <span>{error}</span>
                <button onClick={() => setError('')}>
                  <i className="bi bi-x"></i>
                </button>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="alert-custom alert-success animate-fadeIn">
                <i className="bi bi-check-circle-fill"></i>
                <span>{success}</span>
              </div>
            )}

            {/* Form Card */}
            <div className="setup-card animate-fadeInUp stagger-2">
              <form onSubmit={handleSubmit}>
                
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="step-content">
                    <div className="step-header">
                      <i className="bi bi-person-circle"></i>
                      <div>
                        <h3>Basic Information</h3>
                        <p>Tell us about yourself</p>
                      </div>
                    </div>

                    {/* Avatar Upload */}
                    <div className="avatar-section">
                      <div className="avatar-upload-wrapper">
                        <div className="avatar-preview-large">
                          {previewUrl ? (
                            <img src={previewUrl} alt="Profile" />
                          ) : (
                            <i className="bi bi-person"></i>
                          )}
                          <label htmlFor="avatar-input" className="avatar-edit-btn">
                            <i className="bi bi-camera"></i>
                          </label>
                        </div>
                        <input
                          id="avatar-input"
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          style={{ display: 'none' }}
                          disabled={loading}
                        />
                      </div>
                      <div className="avatar-info">
                        <h5>Profile Photo</h5>
                        <p>Upload a clear photo of yourself. This helps customers recognize you.</p>
                        <span className="text-muted">JPG, PNG or GIF • Max 2MB</span>
                      </div>
                    </div>

                    {/* Name & Phone */}
                    <div className="form-group">
                      <label>
                        Full Name <span className="required">*</span>
                      </label>
                      <div className="input-with-icon">
                        <i className="bi bi-person"></i>
                        <input
                          type="text"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleChange}
                          placeholder="Enter your full name"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>
                        Phone Number <span className="required">*</span>
                      </label>
                      <div className="input-with-icon">
                        <i className="bi bi-telephone"></i>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="e.g., 08012345678"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Service Information */}
                {currentStep === 2 && (
                  <div className="step-content">
                    <div className="step-header">
                      <i className="bi bi-briefcase"></i>
                      <div>
                        <h3>Service Information</h3>
                        <p>Tell customers what you offer</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>
                        Service Category <span className="required">*</span>
                      </label>
                      <div className="input-with-icon">
                        <i className="bi bi-grid"></i>
                        <select
                          name="category_id"
                          value={formData.category_id}
                          onChange={handleChange}
                          disabled={loading}
                        >
                          <option value="">Select your specialty</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>
                          Years of Experience <span className="required">*</span>
                        </label>
                        <div className="input-with-icon">
                          <i className="bi bi-clock-history"></i>
                          <input
                            type="number"
                            name="experience_years"
                            value={formData.experience_years}
                            onChange={handleChange}
                            placeholder="e.g., 5"
                            min="0"
                            max="50"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>
                          Hourly Rate (₦) <span className="required">*</span>
                        </label>
                        <div className="input-with-icon">
                          <i className="bi bi-currency-exchange"></i>
                          <input
                            type="number"
                            name="hourly_rate"
                            value={formData.hourly_rate}
                            onChange={handleChange}
                            placeholder="e.g., 3000"
                            min="0"
                            step="100"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>
                        Skills <span className="required">*</span>
                      </label>
                      <div className="input-with-icon">
                        <i className="bi bi-tools"></i>
                        <input
                          type="text"
                          name="skills"
                          value={formData.skills}
                          onChange={handleChange}
                          placeholder="e.g., Wiring, Installation, Repair"
                          disabled={loading}
                        />
                      </div>
                      <span className="input-hint">Separate skills with commas</span>
                    </div>

                    <div className="form-group">
                      <label>
                        About Your Services <span className="required">*</span>
                      </label>
                      <div className="textarea-wrapper">
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Describe your experience, services, and what makes you stand out..."
                          rows="4"
                          maxLength={500}
                          disabled={loading}
                        ></textarea>
                        <span className="char-count">{formData.description.length}/500</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Location */}
                {currentStep === 3 && (
                  <div className="step-content">
                    <div className="step-header">
                      <i className="bi bi-geo-alt"></i>
                      <div>
                        <h3>Service Location</h3>
                        <p>Where do you provide your services?</p>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>
                          City <span className="required">*</span>
                        </label>
                        <div className="input-with-icon">
                          <i className="bi bi-building"></i>
                          <select
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            disabled={loading}
                          >
                            <option value="Kano">Kano</option>
                            <option value="Kano Municipal">Kano Municipal</option>
                            <option value="Fagge">Fagge</option>
                            <option value="Dala">Dala</option>
                            <option value="Gwale">Gwale</option>
                            <option value="Kumbotso">Kumbotso</option>
                            <option value="Nassarawa">Nassarawa</option>
                            <option value="Tarauni">Tarauni</option>
                            <option value="Ungogo">Ungogo</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>
                          Address <span className="required">*</span>
                        </label>
                        <div className="input-with-icon">
                          <i className="bi bi-geo"></i>
                          <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Your street address or area"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Map Section */}
                    <div className="map-section">
                      <div className="map-header">
                        <div>
                          <h5>
                            <i className="bi bi-pin-map me-2"></i>
                            Pin Your Location
                          </h5>
                          <p>Click on the map to set your exact location</p>
                        </div>
                        <button 
                          type="button"
                          className="btn-location"
                          onClick={getCurrentLocation}
                        >
                          <i className="bi bi-crosshair"></i>
                          Use My Location
                        </button>
                      </div>

                      <div className="map-container">
                        <MapContainer
                          center={[mapPosition.lat, mapPosition.lng]}
                          zoom={13}
                          style={{ height: '300px', width: '100%', borderRadius: '12px' }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          />
                          <LocationMarker />
                        </MapContainer>
                      </div>

                      {locationSelected && (
                        <div className="location-selected">
                          <i className="bi bi-check-circle-fill"></i>
                          <span>Location set: {mapPosition.lat.toFixed(4)}, {mapPosition.lng.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4: Portfolio */}
                {currentStep === 4 && (
                  <div className="step-content">
                    <div className="step-header">
                      <i className="bi bi-images"></i>
                      <div>
                        <h3>Portfolio Gallery</h3>
                        <p>Showcase your best work (optional but recommended)</p>
                      </div>
                    </div>

                    <div className="portfolio-upload-section">
                      <div className="upload-area">
                        <input
                          type="file"
                          id="portfolio-input"
                          multiple
                          accept="image/*"
                          onChange={handlePortfolioChange}
                          style={{ display: 'none' }}
                          disabled={loading || portfolioFiles.length >= 6}
                        />
                        <label 
                          htmlFor="portfolio-input" 
                          className={`upload-label ${portfolioFiles.length >= 6 ? 'disabled' : ''}`}
                        >
                          <div className="upload-icon">
                            <i className="bi bi-cloud-arrow-up"></i>
                          </div>
                          <h5>Upload Work Photos</h5>
                          <p>Drag & drop or click to select</p>
                          <span className="upload-limit">
                            {portfolioFiles.length}/6 images • Max 5MB each
                          </span>
                        </label>
                      </div>

                      {/* Portfolio Preview */}
                      {portfolioPreviews.length > 0 && (
                        <div className="portfolio-grid">
                          {portfolioPreviews.map((preview, index) => (
                            <div key={index} className="portfolio-item">
                              <img src={preview} alt={`Portfolio ${index + 1}`} />
                              <button
                                type="button"
                                className="remove-btn"
                                onClick={() => removePortfolioImage(index)}
                              >
                                <i className="bi bi-x"></i>
                              </button>
                              <span className="item-number">{index + 1}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {portfolioFiles.length === 0 && (
                        <div className="portfolio-tips">
                          <h6><i className="bi bi-lightbulb me-2"></i>Tips for great portfolio photos:</h6>
                          <ul>
                            <li>Show completed projects and before/after comparisons</li>
                            <li>Use good lighting and clear angles</li>
                            <li>Include variety of your work</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="step-navigation">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      className="btn-back"
                      onClick={prevStep}
                      disabled={loading}
                    >
                      <i className="bi bi-arrow-left"></i>
                      Back
                    </button>
                  )}

                  {currentStep < totalSteps ? (
                    <button
                      type="button"
                      className="btn-next"
                      onClick={nextStep}
                      disabled={loading}
                    >
                      Continue
                      <i className="bi bi-arrow-right"></i>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={loading || uploading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner"></span>
                          Creating Profile...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle"></i>
                          Complete Setup
                        </>
                      )}
                    </button>
                  )}
                </div>

              </form>
            </div>

            {/* Help Card */}
            <div className="help-card animate-fadeInUp stagger-3">
              <div className="help-icon">
                <i className="bi bi-question-circle"></i>
              </div>
              <div className="help-content">
                <h6>Need Help?</h6>
                <p>Contact our support team if you have any questions about setting up your profile.</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default ProviderProfileSetup