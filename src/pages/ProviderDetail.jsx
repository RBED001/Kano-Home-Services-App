import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/ProviderDetail.css";
import LocationPickerModal from "../components/LocationPickerModal";
import BookingModal from "../components/BookingModal";

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function ProviderDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [portfolioImages, setPortfolioImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [activeTab, setActiveTab] = useState("about");

  // Calculate average rating from reviews
  const calculatedRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  useEffect(() => {
    fetchProviderDetails();
    fetchReviews();
    fetchPortfolioImages();
  }, [id]);

  const fetchProviderDetails = async () => {
    const { data, error } = await supabase
      .from("service_providers")
      .select(
        `
        *,
        profiles(full_name, phone, city, address, avatar_url),
        service_categories(name, description)
      `
      )
      .eq("id", id)
      .single();

    if (!error) {
      setProvider(data);
    } else {
      console.error("Error fetching provider:", error);
    }
    setLoading(false);
  };

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select(
        `
        *,
        profiles(full_name, avatar_url)
      `
      )
      .eq("provider_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setReviews(data);
    }
  };

  const fetchPortfolioImages = async () => {
    try {
      const { data: providerData, error: providerError } = await supabase
        .from("service_providers")
        .select("user_id")
        .eq("id", id)
        .single();

      if (providerError || !providerData) {
        console.error("Error fetching provider user_id:", providerError);
        return;
      }

      console.log("Fetching portfolio for user_id:", providerData.user_id);

      const { data, error } = await supabase
        .from("portfolio_images")
        .select("*")
        .eq("provider_id", providerData.user_id)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Error fetching portfolio:", error);
        return;
      }

      if (data && data.length > 0) {
        const imagesWithUrls = data.map((img) => {
          if (img.image_url && !img.image_url.startsWith("http")) {
            const {
              data: { publicUrl },
            } = supabase.storage
              .from("work-gallery")
              .getPublicUrl(img.image_url);

            return {
              ...img,
              image_url: publicUrl,
            };
          }
          return img;
        });

        setPortfolioImages(imagesWithUrls);
        console.log("Portfolio images loaded:", imagesWithUrls.length);
      } else {
        setPortfolioImages([]);
        console.log(
          "No portfolio images found for user:",
          providerData.user_id
        );
      }
    } catch (err) {
      console.error("Error in fetchPortfolioImages:", err);
    }
  };

  const handleBookNow = () => {
    if (!user) {
      alert("Please login to book a service");
      navigate("/login");
      return;
    }

    if (profile?.role === "provider") {
      alert("Providers cannot book services. Please use a customer account.");
      return;
    }

    setShowBookingModal(true);
  };

  const getCategoryIcon = (name) => {
    const icons = {
      Electrician: "bi-lightning-charge-fill",
      Plumber: "bi-wrench-adjustable",
      Carpenter: "bi-hammer",
      Painter: "bi-palette-fill",
      Cleaner: "bi-wind",
      "AC Technician": "bi-fan",
      "Generator Technician": "bi-gear-fill",
      Tiler: "bi-bricks",
    };
    return icons[name] || "bi-tools";
  };

  if (loading) {
    return (
      <div className="provider-detail-loading">
        <div className="spinner-custom"></div>
        <p>Loading provider details...</p>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="provider-not-found">
        <div className="not-found-content">
          <i className="bi bi-person-x-fill"></i>
          <h2>Provider Not Found</h2>
          <p>
            The service provider you're looking for doesn't exist or has been
            removed.
          </p>
          <Link to="/providers" className="btn btn-gradient">
            <i className="bi bi-arrow-left me-2"></i>
            Back to Providers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-detail-page">
      {/* Hero Section */}
      <section className="provider-detail-hero">
        <div className="hero-background"></div>
        <div className="container">
          <Link to="/providers" className="back-link animate-fadeInLeft">
            <i className="bi bi-arrow-left"></i>
            <span>Back to Providers</span>
          </Link>

          <div className="hero-content">
            <div className="row align-items-center">
              <div className="col-lg-8">
                <div className="provider-profile-section animate-fadeInUp">
                  {/* Avatar */}
                  <div className="provider-avatar-wrapper">
                    {provider.profiles?.avatar_url ? (
                      <img
                        src={provider.profiles.avatar_url}
                        alt={provider.profiles.full_name}
                        className="provider-avatar"
                      />
                    ) : (
                      <div className="provider-avatar-placeholder">
                        {provider.profiles?.full_name?.charAt(0)}
                      </div>
                    )}
                    {provider.verified && (
                      <div className="verified-badge" title="Verified Provider">
                        <i className="bi bi-patch-check-fill"></i>
                      </div>
                    )}
                    <span
                      className={`availability-dot ${provider.availability}`}
                    ></span>
                  </div>

                  {/* Info */}
                  <div className="provider-info-section">
                    <div className="provider-name-row">
                      <h1 className="provider-name">
                        {provider.profiles?.full_name}
                      </h1>
                    </div>

                    <div className="provider-category">
                      <i
                        className={`bi ${getCategoryIcon(
                          provider.service_categories?.name
                        )}`}
                      ></i>
                      <span>{provider.service_categories?.name}</span>
                    </div>

                    <div className="provider-location">
                      <i className="bi bi-geo-alt-fill"></i>
                      <span>
                        {provider.profiles?.address ||
                          provider.profiles?.city ||
                          "Kano, Nigeria"}
                      </span>
                    </div>

                    {/* Stats Row - FIXED */}
                    <div className="provider-stats-row">
                      <div className="stat-badge rating">
                        <i className="bi bi-star-fill"></i>
                        <span className="stat-value">
                          {calculatedRating.toFixed(1)}
                        </span>
                        <span className="stat-label">
                          ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                        </span>
                      </div>
                      <div className="stat-badge jobs">
                        <i className="bi bi-briefcase-fill"></i>
                        <span className="stat-value">
                          {provider.total_jobs || 0}
                        </span>
                        <span className="stat-label">jobs</span>
                      </div>
                      <div className="stat-badge experience">
                        <i className="bi bi-clock-fill"></i>
                        <span className="stat-value">
                          {provider.experience_years || 0}+
                        </span>
                        <span className="stat-label">years</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Card */}
              <div className="col-lg-4">
                <div className="price-card animate-fadeInRight">
                  <div className="price-header">
                    <span className="price-label">Starting from</span>
                    <div className="price-amount">
                      <span className="currency">₦</span>
                      <span className="amount">
                        {(provider.hourly_rate || 0).toLocaleString()}
                      </span>
                      <span className="unit">/hr</span>
                    </div>
                  </div>

                  <button className="btn btn-book-now" onClick={handleBookNow}>
                    <i className="bi bi-calendar-check me-2"></i>
                    Book Now
                  </button>

                  <div className="price-features">
                    <div className="feature">
                      <i className="bi bi-shield-check"></i>
                      <span>Secure booking</span>
                    </div>
                    <div className="feature">
                      <i className="bi bi-lightning-charge"></i>
                      <span>Quick response</span>
                    </div>
                    <div className="feature">
                      <i className="bi bi-chat-dots"></i>
                      <span>Direct messaging</span>
                    </div>
                    <div className="feature">
                      <i className="bi bi-cash-stack"></i>
                      <span>Fair pricing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Tabs */}
      <section className="provider-content-section">
        <div className="container">
          {/* Tab Navigation */}
          <div className="content-tabs animate-fadeInUp">
            <button
              className={`tab-btn ${activeTab === "about" ? "active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              <i className="bi bi-person-lines-fill me-2"></i>
              About
            </button>
            <button
              className={`tab-btn ${activeTab === "portfolio" ? "active" : ""}`}
              onClick={() => setActiveTab("portfolio")}
            >
              <i className="bi bi-images me-2"></i>
              Portfolio
              {portfolioImages.length > 0 && (
                <span className="tab-count">{portfolioImages.length}</span>
              )}
            </button>
            <button
              className={`tab-btn ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              <i className="bi bi-star-half me-2"></i>
              Reviews
              {reviews.length > 0 && (
                <span className="tab-count">{reviews.length}</span>
              )}
            </button>
          </div>

          <div className="row">
            {/* Main Content */}
            <div className="col-lg-8">
              {/* About Tab */}
              {activeTab === "about" && (
                <div className="tab-content animate-fadeInUp">
                  {/* Description */}
                  <div className="content-card">
                    <h3 className="card-title">
                      <i className="bi bi-info-circle-fill me-2"></i>
                      About Me
                    </h3>
                    <p className="description-text">
                      {provider.description || "No description provided yet."}
                    </p>
                  </div>

                  {/* Skills */}
                  {provider.skills && provider.skills.length > 0 && (
                    <div className="content-card">
                      <h3 className="card-title">
                        <i className="bi bi-tools me-2"></i>
                        Skills & Expertise
                      </h3>
                      <div className="skills-grid">
                        {provider.skills.map((skill, index) => (
                          <div key={index} className="skill-tag">
                            <i className="bi bi-check-circle-fill"></i>
                            <span>{skill}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Service Info */}
                  <div className="content-card">
                    <h3 className="card-title">
                      <i className="bi bi-briefcase-fill me-2"></i>
                      Service Information
                    </h3>
                    <div className="service-info-grid">
                      <div className="info-item">
                        <div className="info-icon">
                          <i className="bi bi-tag-fill"></i>
                        </div>
                        <div className="info-content">
                          <span className="info-label">Service Category</span>
                          <span className="info-value">
                            {provider.service_categories?.name}
                          </span>
                        </div>
                      </div>
                      <div className="info-item">
                        <div className="info-icon">
                          <i className="bi bi-currency-exchange"></i>
                        </div>
                        <div className="info-content">
                          <span className="info-label">Hourly Rate</span>
                          <span className="info-value">
                            ₦{(provider.hourly_rate || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="info-item">
                        <div className="info-icon">
                          <i className="bi bi-calendar-range"></i>
                        </div>
                        <div className="info-content">
                          <span className="info-label">Experience</span>
                          <span className="info-value">
                            {provider.experience_years || 0}+ Years
                          </span>
                        </div>
                      </div>
                      <div className="info-item">
                        <div className="info-icon">
                          <i className="bi bi-check2-all"></i>
                        </div>
                        <div className="info-content">
                          <span className="info-label">Jobs Completed</span>
                          <span className="info-value">
                            {provider.total_jobs || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Portfolio Tab */}
              {activeTab === "portfolio" && (
                <div className="tab-content animate-fadeInUp">
                  <div className="content-card">
                    <h3 className="card-title">
                      <i className="bi bi-images me-2"></i>
                      Work Portfolio
                    </h3>

                    {portfolioImages.length === 0 ? (
                      <div className="empty-portfolio">
                        <i className="bi bi-image"></i>
                        <h5>No portfolio images yet</h5>
                        <p>
                          This provider hasn't uploaded any work samples yet.
                        </p>
                      </div>
                    ) : (
                      <div className="portfolio-grid">
                        {portfolioImages.map((image, index) => (
                          <div
                            key={image.id}
                            className="portfolio-item"
                            onClick={() => setSelectedImage(image)}
                          >
                            <img
                              src={image.image_url}
                              alt={image.description || `Work ${index + 1}`}
                            />
                            <div className="portfolio-overlay">
                              <i className="bi bi-zoom-in"></i>
                            </div>
                            {image.description && (
                              <div className="portfolio-caption">
                                {image.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reviews Tab - FIXED */}
              {activeTab === "reviews" && (
                <div className="tab-content animate-fadeInUp">
                  <div className="content-card">
                    <div className="reviews-header">
                      <h3 className="card-title">
                        <i className="bi bi-star-fill me-2"></i>
                        Customer Reviews
                      </h3>
                      {reviews.length > 0 && (
                        <div className="rating-overview">
                          <div className="rating-big">
                            <span className="rating-number">
                              {calculatedRating.toFixed(1)}
                            </span>
                            <div className="rating-stars">
                              {[...Array(5)].map((_, i) => (
                                <i
                                  key={i}
                                  className={`bi bi-star${
                                    i < Math.round(calculatedRating)
                                      ? "-fill"
                                      : ""
                                  }`}
                                ></i>
                              ))}
                            </div>
                            <span className="rating-count">
                              {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {reviews.length === 0 ? (
                      <div className="empty-reviews">
                        <i className="bi bi-chat-quote"></i>
                        <h5>No reviews yet</h5>
                        <p>Be the first to book and leave a review!</p>
                      </div>
                    ) : (
                      <div className="reviews-list">
                        {reviews.map((review) => (
                          <div key={review.id} className="review-card">
                            <div className="review-header">
                              <div className="reviewer-info">
                                {review.profiles?.avatar_url ? (
                                  <img
                                    src={review.profiles.avatar_url}
                                    alt={review.profiles.full_name}
                                    className="reviewer-avatar"
                                  />
                                ) : (
                                  <div className="reviewer-avatar-placeholder">
                                    {review.profiles?.full_name?.charAt(0)}
                                  </div>
                                )}
                                <div className="reviewer-details">
                                  <strong className="reviewer-name">
                                    {review.profiles?.full_name}
                                  </strong>
                                  <span className="review-date">
                                    {new Date(
                                      review.created_at
                                    ).toLocaleDateString("en-US", {
                                      month: "long",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="review-rating">
                                {[...Array(5)].map((_, i) => (
                                  <i
                                    key={i}
                                    className={`bi bi-star${
                                      i < review.rating ? "-fill" : ""
                                    }`}
                                  ></i>
                                ))}
                              </div>
                            </div>
                            {review.comment && (
                              <p className="review-comment">{review.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="col-lg-4">
              {/* Contact Card */}
              <div className="sidebar-card animate-fadeInUp">
                <h4 className="sidebar-title">
                  <i className="bi bi-person-lines-fill me-2"></i>
                  Contact Information
                </h4>
                <div className="contact-list">
                  <a
                    href={`tel:${provider.profiles?.phone}`}
                    className="contact-item"
                  >
                    <div className="contact-icon">
                      <i className="bi bi-telephone-fill"></i>
                    </div>
                    <div className="contact-info">
                      <span className="contact-label">Phone</span>
                      <span className="contact-value">
                        {provider.profiles?.phone || "Not provided"}
                      </span>
                    </div>
                    <i className="bi bi-chevron-right"></i>
                  </a>
                  <div className="contact-item">
                    <div className="contact-icon">
                      <i className="bi bi-geo-alt-fill"></i>
                    </div>
                    <div className="contact-info">
                      <span className="contact-label">Location</span>
                      <span className="contact-value">
                        {provider.profiles?.city || "Kano"}
                      </span>
                    </div>
                  </div>
                  <div className="contact-item">
                    <div className="contact-icon">
                      <i className="bi bi-circle-fill"></i>
                    </div>
                    <div className="contact-info">
                      <span className="contact-label">Availability</span>
                      <span
                        className={`availability-badge ${provider.availability}`}
                      >
                        {provider.availability === "available"
                          ? "Available"
                          : "Busy"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Card - FIXED */}
              <div className="sidebar-card animate-fadeInUp stagger-1">
                <h4 className="sidebar-title">
                  <i className="bi bi-graph-up me-2"></i>
                  Quick Stats
                </h4>
                <div className="quick-stats-grid">
                  <div className="quick-stat">
                    <div className="stat-icon-box yellow">
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <div className="stat-details">
                      <span className="stats-number">
                        {calculatedRating.toFixed(1)}
                      </span>
                      <span className="stat-text">Rating</span>
                    </div>
                  </div>
                  <div className="quick-stat">
                    <div className="stat-icon-box blue">
                      <i className="bi bi-briefcase-fill"></i>
                    </div>
                    <div className="stat-details">
                      <span className="stats-number">
                        {provider.total_jobs || 0}
                      </span>
                      <span className="stat-text">Jobs Done</span>
                    </div>
                  </div>
                  <div className="quick-stat">
                    <div className="stat-icon-box green">
                      <i className="bi bi-clock-fill"></i>
                    </div>
                    <div className="stat-details">
                      <span className="stats-number">
                        {provider.experience_years || 0}+
                      </span>
                      <span className="stat-text">Years Exp.</span>
                    </div>
                  </div>
                  <div className="quick-stat">
                    <div className="stat-icon-box purple">
                      <i className="bi bi-chat-dots-fill"></i>
                    </div>
                    <div className="stat-details">
                      <span className="stats-number">{reviews.length}</span>
                      <span className="stat-text">Reviews</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA Card */}
              <div className="sidebar-card cta-card animate-fadeInUp stagger-2">
                <div className="cta-content">
                  <i className="bi bi-calendar-heart"></i>
                  <h5>Ready to Book?</h5>
                  <p>Get quality service from this verified provider</p>
                  <button className="btn btn-book-now" onClick={handleBookNow}>
                    <i className="bi bi-calendar-check me-2"></i>
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          provider={provider}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="lightbox-overlay"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-close"
              onClick={() => setSelectedImage(null)}
            >
              <i className="bi bi-x-lg"></i>
            </button>
            <img
              src={selectedImage.image_url}
              alt={selectedImage.description || "Portfolio"}
            />
            {selectedImage.description && (
              <div className="lightbox-caption">
                {selectedImage.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== MAP COMPONENTS ====================
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position} />;
}

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 15);
    }
  }, [position, map]);
  return null;
}

export default ProviderDetail;