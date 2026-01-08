import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import "../styles/ProviderDashboard.css";
import LocationPickerModal from "../components/LocationPickerModal";

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom magenta marker
const customIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ProviderDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [bookings, setBookings] = useState([]);
  const [providerProfile, setProviderProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [bookingUnreadCounts, setBookingUnreadCounts] = useState({});
  const [portfolioImages, setPortfolioImages] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [chats, setChats] = useState([]);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [totalUnreadChats, setTotalUnreadChats] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      fetchProviderProfile();
    }
  }, [user]);

  // Fetch related data when provider profile is loaded
  useEffect(() => {
    if (providerProfile) {
      fetchBookings();
      fetchPortfolio();
      fetchReviews();
      fetchChats();
      fetchUnreadMessagesPerBooking();

      // Subscribe to realtime message updates
      const messageSubscription = supabase
        .channel("provider-messages-dashboard")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadMessagesPerBooking();
            fetchChats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messageSubscription);
      };
    }
  }, [providerProfile, filter]);

  // Calculate profile completion when data changes
  useEffect(() => {
    if (providerProfile && profile) {
      calculateProfileCompletion();
    }
  }, [providerProfile, profile, portfolioImages]);

  // Fetch provider profile
  const fetchProviderProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("service_providers")
        .select(
          `
          *,
          service_categories(id, name, icon_url)
        `
        )
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching provider profile:", error);
      }

      if (data) {
        setProviderProfile(data);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error:", err);
      setLoading(false);
    }
  };

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      let query = supabase
        .from("bookings")
        .select(
          `
          *,
          profiles!customer_id(id, full_name, phone, address, avatar_url),
          service_categories(id, name)
        `
        )
        .eq("provider_id", providerProfile.id)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (!error) {
        setBookings(data || []);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    }
  };

  // Fetch portfolio images
  const fetchPortfolio = async () => {
    try {
      console.log("Fetching portfolio for user:", user.id);

      const { data, error } = await supabase
        .from("portfolio_images")
        .select("*")
        .eq("provider_id", user.id) // ← Use user.id
        .order("display_order", { ascending: true });

      console.log("Portfolio fetch result:", { data, error });

      if (error) {
        console.error("Error fetching portfolio:", error);
        return;
      }

      setPortfolioImages(data || []);
      console.log("Portfolio images set:", data?.length || 0, "images");
    } catch (err) {
      console.error("Error fetching portfolio:", err);
    }
  };

  // Fetch reviews
  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          `
          *,
          profiles!customer_id(id, full_name, avatar_url),
          bookings!booking_id(id, scheduled_date, service_categories(name))
        `
        )
        .eq("provider_id", providerProfile.id)
        .order("created_at", { ascending: false });

      if (!error) {
        setReviews(data || []);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  // Fetch chats
  const fetchChats = async () => {
    try {
      // Get all bookings with messages
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          booking_id,
          sender_id,
          receiver_id,
          message,
          read,
          created_at
        `
        )
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group messages by booking
      const bookingIds = [...new Set(messagesData?.map((m) => m.booking_id))];

      // Fetch booking details with customer info
      const chatList = [];
      let totalUnread = 0;

      for (const bookingId of bookingIds) {
        const { data: bookingData } = await supabase
          .from("bookings")
          .select(
            `
            id,
            status,
            profiles!customer_id(id, full_name, avatar_url)
          `
          )
          .eq("id", bookingId)
          .single();

        if (bookingData) {
          // Get last message
          const lastMessage = messagesData.find(
            (m) => m.booking_id === bookingId
          );

          // Count unread messages
          const unreadCount = messagesData.filter(
            (m) =>
              m.booking_id === bookingId && m.receiver_id === user.id && !m.read
          ).length;

          totalUnread += unreadCount;

          chatList.push({
            booking_id: bookingId,
            customer: bookingData.profiles,
            status: bookingData.status,
            lastMessage: lastMessage,
            unreadCount: unreadCount,
          });
        }
      }

      setChats(chatList);
      setTotalUnreadChats(totalUnread);
    } catch (err) {
      console.error("Error fetching chats:", err);
    }
  };

  // Fetch unread messages per booking
  const fetchUnreadMessagesPerBooking = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("booking_id")
        .eq("receiver_id", user.id)
        .eq("read", false);

      if (!error && data) {
        const counts = data.reduce((acc, msg) => {
          acc[msg.booking_id] = (acc[msg.booking_id] || 0) + 1;
          return acc;
        }, {});
        setBookingUnreadCounts(counts);
      }
    } catch (err) {
      console.error("Error fetching unread messages:", err);
    }
  };

  // Calculate profile completion
  const calculateProfileCompletion = () => {
    const fields = [
      { value: profile?.full_name, weight: 10 },
      { value: profile?.phone, weight: 10 },
      { value: profile?.avatar_url, weight: 15 },
      { value: profile?.address, weight: 10 },
      { value: profile?.city, weight: 5 },
      { value: providerProfile?.description, weight: 15 },
      { value: providerProfile?.hourly_rate, weight: 10 },
      { value: providerProfile?.experience_years, weight: 5 },
      { value: providerProfile?.skills?.length > 0, weight: 10 },
      { value: portfolioImages.length > 0, weight: 10 },
    ];

    const completed = fields.reduce((sum, field) => {
      return sum + (field.value ? field.weight : 0);
    }, 0);

    setProfileCompletion(completed);
  };

  // Update booking status
  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (!error) {
        // Update total jobs if completed
        if (newStatus === "completed") {
          await supabase
            .from("service_providers")
            .update({
              total_jobs: (providerProfile.total_jobs || 0) + 1,
            })
            .eq("id", providerProfile.id);

          fetchProviderProfile();
        }

        fetchBookings();
        alert(`Booking ${newStatus.replace("_", " ")} successfully!`);
      }
    } catch (err) {
      console.error("Error updating booking:", err);
      alert("Failed to update booking status");
    }
  };

  // Get status badge class
  const getStatusBadge = (status) => {
    const badges = {
      pending: "status-pending",
      accepted: "status-accepted",
      in_progress: "status-progress",
      completed: "status-completed",
      cancelled: "status-cancelled",
    };
    return badges[status] || "status-default";
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const icons = {
      pending: "bi-clock-history",
      accepted: "bi-check2-circle",
      in_progress: "bi-gear-fill",
      completed: "bi-check-circle-fill",
      cancelled: "bi-x-circle-fill",
    };
    return icons[status] || "bi-circle";
  };

  // Get payment status badge
  const getPaymentBadge = (status) => {
    const badges = {
      paid: "payment-paid",
      unpaid: "payment-unpaid",
      pending: "payment-pending",
      refunded: "payment-refunded",
    };
    return badges[status] || "payment-unpaid";
  };

  // Calculate stats
  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    active: bookings.filter((b) =>
      ["accepted", "in_progress"].includes(b.status)
    ).length,
    completed: bookings.filter((b) => b.status === "completed").length,
  };

  // Get missing profile fields
  const getMissingFields = () => {
    const missing = [];
    if (!profile?.avatar_url)
      missing.push({
        field: "Profile Photo",
        tab: "profile",
        icon: "bi-camera",
      });
    if (!profile?.phone)
      missing.push({
        field: "Phone Number",
        tab: "profile",
        icon: "bi-telephone",
      });
    if (!profile?.address)
      missing.push({ field: "Address", tab: "profile", icon: "bi-geo-alt" });
    if (!providerProfile?.description)
      missing.push({
        field: "Bio/Description",
        tab: "services",
        icon: "bi-file-text",
      });
    if (!providerProfile?.skills?.length)
      missing.push({ field: "Skills", tab: "services", icon: "bi-tools" });
    if (portfolioImages.length === 0)
      missing.push({
        field: "Portfolio Images",
        tab: "portfolio",
        icon: "bi-images",
      });
    return missing;
  };

  // Show setup message if no provider profile
  if (!loading && !providerProfile) {
    return (
      <div className="provider-setup-prompt">
        <div className="container">
          <div className="setup-card">
            <div className="setup-icon">
              <i className="bi bi-person-badge"></i>
            </div>
            <h2>Complete Your Provider Profile</h2>
            <p>
              Set up your service provider profile to start receiving bookings
              from customers.
            </p>
            <Link to="/provider-setup" className="btn btn-gradient btn-lg">
              <i className="bi bi-arrow-right-circle me-2"></i>
              Complete Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-custom"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="provider-dashboard">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button
          className="menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <i className={`bi ${mobileMenuOpen ? "bi-x-lg" : "bi-list"}`}></i>
        </button>
        <h1 className="mobile-title">Dashboard</h1>
        <div className="mobile-avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} />
          ) : (
            <span>{profile?.full_name?.charAt(0) || "P"}</span>
          )}
        </div>
      </div>

      <div className="dashboard-container">
        {/* Sidebar */}
       <aside className={`dashboard-sidebar ${mobileMenuOpen ? "open" : ""}`}>
  <div className="sidebar-content">
    {/* User Profile Card */}
    <div className="sidebar-profile">
      <div className="profile-avatar">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name} />
        ) : (
          <div className="avatar-placeholder">
            {profile?.full_name?.charAt(0) || "P"}
          </div>
        )}
        <span
          className={`status-dot ${
            providerProfile?.availability || "available"
          }`}
        ></span>
      </div>
      <h4 className="profile-name">{profile?.full_name}</h4>
      <p className="profile-category">
        <i className="bi bi-briefcase me-1"></i>
        {providerProfile?.service_categories?.name ||
          "Service Provider"}
      </p>
      <div className="profile-stats">
        <div className="stat">
          <i className="bi bi-star-fill"></i>
          <span>
            {reviews.length > 0
              ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
              : "0.0"}
          </span>
        </div>
        <div className="stat">
          <i className="bi bi-briefcase"></i>
          <span>
            {bookings.filter(b => b.status === 'completed').length} jobs
          </span>
        </div>
      </div>
    </div>

    {/* Navigation -  */}
    <nav className="sidebar-nav">
      <button
        className={`nav-item ${
          activeTab === "overview" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("overview");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-grid-1x2-fill"></i>
        <span>Overview</span>
      </button>

      <button
        className={`nav-item ${
          activeTab === "bookings" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("bookings");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-calendar-check-fill"></i>
        <span>Job Requests</span>
        {bookings.filter(b => b.status === 'pending').length > 0 && (
          <span className="nav-badge pulse">
            {bookings.filter(b => b.status === 'pending').length}
          </span>
        )}
      </button>

      <button
        className={`nav-item ${activeTab === "chats" ? "active" : ""}`}
        onClick={() => {
          setActiveTab("chats");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-chat-dots-fill"></i>
        <span>Chats</span>
        {totalUnreadChats > 0 && (
          <span className="nav-badge pulse">{totalUnreadChats}</span>
        )}
      </button>

      <button
        className={`nav-item ${
          activeTab === "reviews" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("reviews");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-star-fill"></i>
        <span>Reviews</span>
        {reviews.length > 0 && (
          <span className="nav-badge-muted">{reviews.length}</span>
        )}
      </button>

      <button
        className={`nav-item ${
          activeTab === "portfolio" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("portfolio");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-images"></i>
        <span>Portfolio</span>
      </button>

      <div className="nav-divider"></div>

      <button
        className={`nav-item ${
          activeTab === "profile" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("profile");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-person-fill"></i>
        <span>Profile</span>
      </button>

      <button
        className={`nav-item ${
          activeTab === "services" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("services");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-gear-fill"></i>
        <span>Services</span>
      </button>

      <button
        className={`nav-item ${
          activeTab === "security" ? "active" : ""
        }`}
        onClick={() => {
          setActiveTab("security");
          setMobileMenuOpen(false);
        }}
      >
        <i className="bi bi-shield-lock-fill"></i>
        <span>Security</span>
      </button>

      <div className="nav-divider"></div>

      <button className="nav-item logout" onClick={signOut}>
        <i className="bi bi-box-arrow-right"></i>
        <span>Logout</span>
      </button>
    </nav>
  </div>
</aside>
        {/* Overlay for mobile */}
        {mobileMenuOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <OverviewTab
              profile={profile}
              providerProfile={providerProfile}
              stats={stats}
              bookings={bookings}
              reviews={reviews}
              profileCompletion={profileCompletion}
              getMissingFields={getMissingFields}
              setActiveTab={setActiveTab}
              getStatusIcon={getStatusIcon}
              bookingUnreadCounts={bookingUnreadCounts}
            />
          )}

          {/* Bookings Tab */}
          {activeTab === "bookings" && (
            <BookingsTab
              bookings={bookings}
              loading={loading}
              filter={filter}
              setFilter={setFilter}
              stats={stats}
              getStatusBadge={getStatusBadge}
              getStatusIcon={getStatusIcon}
              getPaymentBadge={getPaymentBadge}
              updateBookingStatus={updateBookingStatus}
              bookingUnreadCounts={bookingUnreadCounts}
              fetchBookings={fetchBookings}
            />
          )}

          {/* Chats Tab */}
          {activeTab === "chats" && (
            <ChatsTab chats={chats} user={user} fetchChats={fetchChats} />
          )}

          {/* Reviews Tab */}
          {activeTab === "reviews" && (
            <ReviewsTab reviews={reviews} providerProfile={providerProfile} />
          )}

          {/* Portfolio Tab */}
          {activeTab === "portfolio" && (
            <PortfolioTab
              user={user}
              portfolioImages={portfolioImages}
              fetchPortfolio={fetchPortfolio}
            />
          )}
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <ProfileTab
              user={user}
              profile={profile}
              providerProfile={providerProfile}
              fetchProviderProfile={fetchProviderProfile}
            />
          )}

          {/* Services Tab */}
          {activeTab === "services" && (
            <ServicesTab
              providerProfile={providerProfile}
              fetchProviderProfile={fetchProviderProfile}
            />
          )}

          {/* Security Tab */}
          {activeTab === "security" && <SecurityTab user={user} />}
        </main>
      </div>
    </div>
  );
}

// ============================================
// OVERVIEW TAB COMPONENT
// ============================================
function OverviewTab({
  profile,
  providerProfile,
  stats,
  bookings,
  reviews,
  profileCompletion,
  getMissingFields,
  setActiveTab,
  getStatusIcon,
  bookingUnreadCounts,
}) {
  const recentBookings = bookings.slice(0, 5);
  const recentReviews = reviews.slice(0, 3);
  const missingFields = getMissingFields();

  const getCompletionColor = () => {
    if (profileCompletion >= 80) return "success";
    if (profileCompletion >= 50) return "warning";
    return "danger";
  };

  return (
    <div className="tab-content animate-fadeIn">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1>Welcome back, {profile?.full_name?.split(" ")[0]}! 👋</h1>
          <p>Here's what's happening with your business today</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-gradient"
            onClick={() => setActiveTab("bookings")}
          >
            <i className="bi bi-calendar-check me-2"></i>
            View All Jobs
          </button>
        </div>
      </div>

      {/* Profile Completion Card */}
      {profileCompletion < 100 && (
        <div className={`completion-card completion-${getCompletionColor()}`}>
          <div className="completion-header">
            <div className="completion-icon">
              <i className="bi bi-person-check"></i>
            </div>
            <div className="completion-info">
              <h3>Complete Your Profile</h3>
              <p>A complete profile attracts more customers</p>
            </div>
            <div className="completion-percentage">
              <div className="percentage-circle">
                <svg viewBox="0 0 36 36">
                  <path
                    className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle-progress"
                    strokeDasharray={`${profileCompletion}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span>{profileCompletion}%</span>
              </div>
            </div>
          </div>

          <div className="completion-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${profileCompletion}%` }}
              ></div>
            </div>
          </div>

          <div className="missing-fields">
            <p>Complete these to reach 100%:</p>
            <div className="missing-items">
              {missingFields.map((item, index) => (
                <button
                  key={index}
                  className="missing-item"
                  onClick={() => setActiveTab(item.tab)}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.field}</span>
                  <i className="bi bi-chevron-right"></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

     {/* Stats Grid */}
<div className="stats-grid">
  <div className="stat-card">
    <div className="stat-icon primary">
      <i className="bi bi-briefcase"></i>
    </div>
    <div className="stat-content">
      <span className="stat-value">
        {bookings.filter(b => b.status === 'completed').length}
      </span>
      <span className="stat-label">Total Jobs</span>
    </div>
  </div>

  <div className="stat-card">
    <div className="stat-icon warning">
      <i className="bi bi-clock-history"></i>
    </div>
    <div className="stat-content">
      <span className="stat-value">{stats.pending}</span>
      <span className="stat-label">Pending</span>
    </div>
  </div>

  <div className="stat-card">
    <div className="stat-icon info">
      <i className="bi bi-gear"></i>
    </div>
    <div className="stat-content">
      <span className="stat-value">{stats.active}</span>
      <span className="stat-label">Active</span>
    </div>
  </div>

  <div className="stat-card">
    <div className="stat-icon success">
      <i className="bi bi-star-fill"></i>
    </div>
    <div className="stat-content">
      <span className="stat-value">
        {reviews.length > 0
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : "0.0"}
      </span>
      <span className="stat-label">Rating ({reviews.length})</span>
    </div>
  </div>
</div>

      {/* Quick Info Cards */}
      <div className="quick-info-grid">
        <div className="quick-info-card">
          <i className="bi bi-currency-exchange"></i>
          <div>
            <span className="label">Hourly Rate</span>
            <span className="value">
              ₦{providerProfile?.hourly_rate?.toLocaleString() || 0}
            </span>
          </div>
        </div>
        <div className="quick-info-card">
          <i className="bi bi-geo-alt"></i>
          <div>
            <span className="label">Location</span>
            <span className="value">{profile?.city || "Not set"}</span>
          </div>
        </div>
        <div className="quick-info-card">
          <div
            className={`availability-dot ${
              providerProfile?.availability || "available"
            }`}
          ></div>
          <div>
            <span className="label">Status</span>
            <span className="value text-capitalize">
              {providerProfile?.availability || "Available"}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-grid">
        {/* Recent Bookings */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Recent Job Requests</h3>
            <button
              className="btn-link"
              onClick={() => setActiveTab("bookings")}
            >
              View all <i className="bi bi-arrow-right"></i>
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-inbox"></i>
              <p>No job requests yet</p>
              <span>New requests will appear here</span>
            </div>
          ) : (
            <div className="booking-list">
              {recentBookings.map((booking) => (
                <Link
                  key={booking.id}
                  to={`/booking/${booking.id}`}
                  className="booking-list-item"
                >
                  <div className="booking-avatar">
                    {booking.profiles?.avatar_url ? (
                      <img src={booking.profiles.avatar_url} alt="" />
                    ) : (
                      <span>
                        {booking.profiles?.full_name?.charAt(0) || "C"}
                      </span>
                    )}
                    {bookingUnreadCounts[booking.id] > 0 && (
                      <span className="unread-dot"></span>
                    )}
                  </div>
                  <div className="booking-info">
                    <h4>{booking.profiles?.full_name}</h4>
                    <p>{booking.service_categories?.name}</p>
                  </div>
                  <div className="booking-meta">
                    <span className="booking-date">
                      {new Date(booking.scheduled_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                    <span className={`status-badge ${booking.status}`}>
                      <i className={`bi ${getStatusIcon(booking.status)}`}></i>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reviews */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Recent Reviews</h3>
            <button
              className="btn-link"
              onClick={() => setActiveTab("reviews")}
            >
              View all <i className="bi bi-arrow-right"></i>
            </button>
          </div>

          {recentReviews.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-star"></i>
              <p>No reviews yet</p>
              <span>Complete jobs to get reviews</span>
            </div>
          ) : (
            <div className="review-list">
              {recentReviews.map((review) => (
                <div key={review.id} className="review-list-item">
                  <div className="review-header">
                    <div className="reviewer-info">
                      {review.profiles?.avatar_url ? (
                        <img src={review.profiles.avatar_url} alt="" />
                      ) : (
                        <div className="avatar-sm">
                          {review.profiles?.full_name?.charAt(0) || "C"}
                        </div>
                      )}
                      <div>
                        <h4>{review.profiles?.full_name}</h4>
                        <div className="stars">
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
                    </div>
                    <span className="review-date">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
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
    </div>
  );
}

// ============================================
// BOOKINGS TAB COMPONENT
// ============================================
function BookingsTab({
  bookings,
  loading,
  filter,
  setFilter,
  stats,
  getStatusBadge,
  getStatusIcon,
  getPaymentBadge,
  updateBookingStatus,
  bookingUnreadCounts,
}) {
  const filters = [
    { value: "all", label: "All", count: bookings.length },
    { value: "pending", label: "Pending", count: stats.pending },
    {
      value: "accepted",
      label: "Accepted",
      count: bookings.filter((b) => b.status === "accepted").length,
    },
    {
      value: "in_progress",
      label: "In Progress",
      count: bookings.filter((b) => b.status === "in_progress").length,
    },
    { value: "completed", label: "Completed", count: stats.completed },
    {
      value: "cancelled",
      label: "Cancelled",
      count: bookings.filter((b) => b.status === "cancelled").length,
    },
  ];

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Job Requests</h1>
          <p>Manage all your booking requests</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {filters.map((f) => (
          <button
            key={f.value}
            className={`filter-tab ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            <span>{f.label}</span>
            <span className="count">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Bookings Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner-custom"></div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state-large">
          <i className="bi bi-inbox"></i>
          <h3>No bookings found</h3>
          <p>
            {filter === "all"
              ? "You don't have any bookings yet"
              : `No ${filter.replace("_", " ")} bookings`}
          </p>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              {/* Unread indicator */}
              {bookingUnreadCounts[booking.id] > 0 && (
                <div className="unread-indicator">
                  <span>{bookingUnreadCounts[booking.id]}</span>
                  <small>new</small>
                </div>
              )}

              {/* Status Header */}
              <div
                className={`booking-status-bar ${getStatusBadge(
                  booking.status
                )}`}
              >
                <i className={`bi ${getStatusIcon(booking.status)}`}></i>
                <span>{booking.status.replace("_", " ")}</span>
              </div>

              {/* Payment Status - Always visible for completed jobs */}
              {booking.status === "completed" && (
                <div
                  className={`payment-badge ${getPaymentBadge(
                    booking.payment_status
                  )}`}
                >
                  <i className="bi bi-credit-card"></i>
                  <span>{booking.payment_status || "Unpaid"}</span>
                  {booking.payment_amount && (
                    <span className="amount">
                      ₦{booking.payment_amount.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Card Body */}
              <div className="booking-card-body">
                {/* Service */}
                <div className="booking-service">
                  <h3>{booking.service_categories?.name}</h3>
                  <span className="booking-id">#{booking.id.slice(0, 8)}</span>
                </div>

                {/* Customer Info */}
                <div className="booking-customer">
                  <div className="customer-avatar">
                    {booking.profiles?.avatar_url ? (
                      <img src={booking.profiles.avatar_url} alt="" />
                    ) : (
                      <span>
                        {booking.profiles?.full_name?.charAt(0) || "C"}
                      </span>
                    )}
                  </div>
                  <div className="customer-info">
                    <h4>{booking.profiles?.full_name}</h4>
                    <span>Customer</span>
                  </div>
                </div>

                {/* Description */}
                {booking.description && (
                  <p className="booking-description">
                    {booking.description.length > 100
                      ? booking.description.substring(0, 100) + "..."
                      : booking.description}
                  </p>
                )}

                {/* Details Grid */}
                <div className="booking-details">
                  <div className="detail-item">
                    <i className="bi bi-calendar-event"></i>
                    <span>
                      {new Date(booking.scheduled_date).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <i className="bi bi-clock"></i>
                    <span>{booking.scheduled_time}</span>
                  </div>
                  <div className="detail-item">
                    <i className="bi bi-geo-alt"></i>
                    <span>{booking.location || "Not specified"}</span>
                  </div>
                  <div className="detail-item">
                    <i className="bi bi-telephone"></i>
                    <span>{booking.profiles?.phone || "N/A"}</span>
                  </div>
                </div>

                {/* Price if available */}
                {booking.price && (
                  <div className="booking-price">
                    <span>Agreed Price:</span>
                    <strong>₦{booking.price.toLocaleString()}</strong>
                  </div>
                )}

                {/* Actions */}
                <div className="booking-actions">
                  {booking.status === "pending" && (
                    <>
                      <button
                        className="btn-action accept"
                        onClick={() =>
                          updateBookingStatus(booking.id, "accepted")
                        }
                      >
                        <i className="bi bi-check-lg"></i>
                        Accept
                      </button>
                      <button
                        className="btn-action reject"
                        onClick={() =>
                          updateBookingStatus(booking.id, "cancelled")
                        }
                      >
                        <i className="bi bi-x-lg"></i>
                        Decline
                      </button>
                    </>
                  )}

                  {booking.status === "accepted" && (
                    <button
                      className="btn-action start"
                      onClick={() =>
                        updateBookingStatus(booking.id, "in_progress")
                      }
                    >
                      <i className="bi bi-play-fill"></i>
                      Start Work
                    </button>
                  )}

                  {booking.status === "in_progress" && (
                    <button
                      className="btn-action complete"
                      onClick={() =>
                        updateBookingStatus(booking.id, "completed")
                      }
                    >
                      <i className="bi bi-check-circle"></i>
                      Mark Complete
                    </button>
                  )}

                  {/* Chat Button - Always visible except pending and cancelled */}
                  {!["pending", "cancelled"].includes(booking.status) && (
                    <Link
                      to={`/chat/${booking.id}`}
                      className="btn-action chat"
                    >
                      <i className="bi bi-chat-dots"></i>
                      Chat
                      {bookingUnreadCounts[booking.id] > 0 && (
                        <span className="chat-badge">
                          {bookingUnreadCounts[booking.id]}
                        </span>
                      )}
                    </Link>
                  )}

                  <Link
                    to={`/booking/${booking.id}`}
                    className="btn-action details"
                  >
                    <i className="bi bi-eye"></i>
                    Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CHATS TAB COMPONENT (WhatsApp Style)
// ============================================
function ChatsTab({ chats, user, fetchChats }) {
  const [deleteLoading, setDeleteLoading] = useState(null);

  const handleDeleteChat = async (bookingId) => {
    if (
      !window.confirm("Delete this conversation? This action cannot be undone.")
    ) {
      return;
    }

    setDeleteLoading(bookingId);
    try {
      // Delete messages where user is sender or receiver for this booking
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("booking_id", bookingId)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (!error) {
        fetchChats();
      } else {
        alert("Failed to delete chat");
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
      alert("Failed to delete chat");
    } finally {
      setDeleteLoading(null);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Messages</h1>
          <p>Your conversations with customers</p>
        </div>
      </div>

      {chats.length === 0 ? (
        <div className="empty-state-large">
          <i className="bi bi-chat-dots"></i>
          <h3>No conversations yet</h3>
          <p>Messages from your customers will appear here</p>
        </div>
      ) : (
        <div className="chats-container">
          <div className="chat-list">
            {chats.map((chat) => (
              <div key={chat.booking_id} className="chat-item">
                <Link to={`/chat/${chat.booking_id}`} className="chat-link">
                  <div className="chat-avatar">
                    {chat.customer?.avatar_url ? (
                      <img src={chat.customer.avatar_url} alt="" />
                    ) : (
                      <span>{chat.customer?.full_name?.charAt(0) || "C"}</span>
                    )}
                    {chat.unreadCount > 0 && (
                      <span className="online-dot"></span>
                    )}
                  </div>

                  <div className="chat-content">
                    <div className="chat-header">
                      <h4>{chat.customer?.full_name || "Customer"}</h4>
                      <span className="chat-time">
                        {formatTime(chat.lastMessage?.created_at)}
                      </span>
                    </div>
                    <div className="chat-preview">
                      <p className={chat.unreadCount > 0 ? "unread" : ""}>
                        {chat.lastMessage?.sender_id === user.id && (
                          <span className="you-prefix">You: </span>
                        )}
                        {chat.lastMessage?.message || "No messages yet"}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="unread-count">{chat.unreadCount}</span>
                      )}
                    </div>
                    <div className="chat-status">
                      <span className={`status-tag ${chat.status}`}>
                        {chat.status?.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </Link>

                <button
                  className="chat-delete-btn"
                  onClick={() => handleDeleteChat(chat.booking_id)}
                  disabled={deleteLoading === chat.booking_id}
                >
                  {deleteLoading === chat.booking_id ? (
                    <span className="spinner-sm"></span>
                  ) : (
                    <i className="bi bi-trash3"></i>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// REVIEWS TAB COMPONENT
// ============================================
function ReviewsTab({ reviews, providerProfile }) {
  // Calculate average rating from reviews
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  // Calculate rating stats
  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => r.rating === rating).length / reviews.length) *
          100
        : 0,
  }));

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Reviews & Ratings</h1>
          <p>What customers are saying about you</p>
        </div>
      </div>

      {/* Rating Summary */}
      <div className="rating-summary-card">
        <div className="rating-big">
          <span className="rating-value">
            {averageRating.toFixed(1)}
          </span>
          <div className="rating-stars">
            {[...Array(5)].map((_, i) => (
              <i
                key={i}
                className={`bi bi-star${
                  i < Math.round(averageRating) ? "-fill" : ""
                }`}
              ></i>
            ))}
          </div>
          <span className="rating-count">
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        <div className="rating-bars">
          {ratingCounts.map(({ rating, count, percentage }) => (
            <div key={rating} className="rating-bar-row">
              <span className="rating-label">{rating}</span>
              <i className="bi bi-star-fill"></i>
              <div className="rating-bar">
                <div
                  className="rating-bar-fill"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <span className="rating-bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List remains the same */}
      {reviews.length === 0 ? (
        <div className="empty-state-large">
          <i className="bi bi-star"></i>
          <h3>No reviews yet</h3>
          <p>Complete more jobs to receive customer reviews</p>
        </div>
      ) : (
        <div className="reviews-list">
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="reviewer">
                  {review.profiles?.avatar_url ? (
                    <img src={review.profiles.avatar_url} alt="" />
                  ) : (
                    <div className="reviewer-avatar">
                      {review.profiles?.full_name?.charAt(0) || "C"}
                    </div>
                  )}
                  <div className="reviewer-info">
                    <h4>{review.profiles?.full_name}</h4>
                    <span className="review-service">
                      {review.bookings?.service_categories?.name}
                    </span>
                  </div>
                </div>
                <div className="review-meta">
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
                  <span className="review-date">
                    {new Date(review.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              {review.comment && (
                <p className="review-text">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// PORTFOLIO TAB COMPONENT
// ============================================
function PortfolioTab({ user, portfolioImages, fetchPortfolio }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);

    if (files.length + portfolioImages.length > 10) {
      alert("Maximum 10 portfolio images allowed");
      return;
    }

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is too large. Maximum size is 5MB`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("work-gallery")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("work-gallery").getPublicUrl(fileName);

        console.log("Uploading with user.id:", user.id);

        // Insert into database
        const { error: dbError } = await supabase
          .from("portfolio_images")
          .insert({
            provider_id: user.id, // ← Use user.id
            image_url: publicUrl,
            description: null,
            display_order: portfolioImages.length + i,
          });

        if (dbError) {
          console.error("Database error:", dbError);
          throw dbError;
        }
      }

      // Refresh portfolio
      await fetchPortfolio();
      alert("Images uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId, imageUrl) => {
    if (!window.confirm("Delete this image from your portfolio?")) return;

    setDeleting(imageId);
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from("portfolio_images")
        .delete()
        .eq("id", imageId)
        .eq("provider_id", user.id); // ← Use user.id

      if (dbError) throw dbError;

      // Try to delete from storage
      try {
        const urlParts = imageUrl.split("/work-gallery/");
        if (urlParts[1]) {
          await supabase.storage.from("work-gallery").remove([urlParts[1]]);
        }
      } catch (storageErr) {
        console.log("Storage deletion optional:", storageErr);
      }

      // Refresh portfolio
      await fetchPortfolio();
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete image");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Portfolio Gallery</h1>
          <p>Showcase your best work to attract customers</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="portfolio-upload-card">
        <input
          type="file"
          id="portfolio-upload"
          multiple
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading || portfolioImages.length >= 10}
          style={{ display: "none" }}
        />
        <label
          htmlFor="portfolio-upload"
          className={`upload-zone ${uploading ? "uploading" : ""} ${
            portfolioImages.length >= 10 ? "disabled" : ""
          }`}
        >
          {uploading ? (
            <>
              <div className="spinner-custom"></div>
              <p>Uploading...</p>
            </>
          ) : (
            <>
              <i className="bi bi-cloud-arrow-up"></i>
              <h4>Upload Work Photos</h4>
              <p>Click or drag images here</p>
              <span>{portfolioImages.length}/10 images • Max 5MB each</span>
            </>
          )}
        </label>
      </div>

      {/* Portfolio Grid */}
      {portfolioImages.length === 0 ? (
        <div className="empty-state-large">
          <i className="bi bi-images"></i>
          <h3>No portfolio images yet</h3>
          <p>Upload photos of your work to showcase your skills</p>
        </div>
      ) : (
        <div className="portfolio-grid">
          {portfolioImages.map((image, index) => (
            <div key={image.id} className="portfolio-item">
              <img src={image.image_url} alt={`Portfolio ${index + 1}`} />
              <div className="portfolio-overlay">
                <button
                  className="delete-btn"
                  onClick={() => deleteImage(image.id, image.image_url)}
                  disabled={deleting === image.id}
                >
                  {deleting === image.id ? (
                    <span className="spinner-sm"></span>
                  ) : (
                    <i className="bi bi-trash3"></i>
                  )}
                </button>
              </div>
              <span className="portfolio-number">{index + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// LOCATION PICKER MODAL COMPONENT
// ============================================

<LocationPickerModal />;

// ============================================
//  PROFILE TAB COMPONENT WITH  MAP
// ============================================
function ProfileTab({ user, profile, providerProfile, fetchProviderProfile }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile?.avatar_url || null);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    address: profile?.address || "",
    city: profile?.city || "Kano",
    latitude: null,
    longitude: null,
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image must be less than 2MB");
        return;
      }
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleLocationSelect = (locationData) => {
    setFormData({
      ...formData,
      address: locationData.address,
      latitude: locationData.position.lat,
      longitude: locationData.position.lng,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let avatarUrl = previewUrl;

      if (avatarFile) {
        setUploading(true);
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile);

        if (uploadErr) throw uploadErr;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(fileName);

        avatarUrl = publicUrl;
        setUploading(false);
      }

      // Update profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileErr) throw profileErr;

      setSuccess("Profile updated successfully!");
      fetchProviderProfile();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Profile Settings</h1>
          <p>Manage your personal information</p>
        </div>
      </div>

      {success && (
        <div className="alert-success">
          <i className="bi bi-check-circle-fill"></i>
          {success}
        </div>
      )}

      {error && (
        <div className="alert-error">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {error}
        </div>
      )}

      <div className="settings-card">
        <form onSubmit={handleSubmit}>
          {/* Avatar */}
          <div className="avatar-edit-section">
            <div className="avatar-large">
              {previewUrl ? (
                <img src={previewUrl} alt="" />
              ) : (
                <i className="bi bi-person"></i>
              )}
              <label htmlFor="avatar-edit" className="avatar-edit-btn">
                <i className="bi bi-camera-fill"></i>
              </label>
              <input
                type="file"
                id="avatar-edit"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
            </div>
            <div className="avatar-info">
              <h4>Profile Photo</h4>
              <p>JPG, PNG or GIF • Max 2MB</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Your full name"
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Your phone number"
              />
            </div>

            <div className="form-group">
              <label>City</label>
              <select name="city" value={formData.city} onChange={handleChange}>
                <option value="Kano">Kano</option>
                <option value="Kano Municipal">Kano Municipal</option>
                <option value="Fagge">Fagge</option>
                <option value="Dala">Dala</option>
                <option value="Gwale">Gwale</option>
                <option value="Tarauni">Tarauni</option>
                <option value="Nassarawa">Nassarawa</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user?.email} disabled />
              <span className="input-hint">Email cannot be changed</span>
            </div>
          </div>

          {/* Enhanced Address Field with Map Button */}
          <div className="form-group full-width">
            <label>Service Address</label>
            <div className="address-input-wrapper">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter your address or use map to select"
              />
              <button
                type="button"
                className="btn-map-select"
                onClick={() => setShowMapModal(true)}
              >
                <i className="bi bi-map"></i>
                <span>Select on Map</span>
              </button>
            </div>
            <span className="input-hint">
              <i className="bi bi-info-circle"></i>
              You can type your address manually or use the map for precise
              location
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-gradient btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onSelectLocation={handleLocationSelect}
        initialPosition={
          formData.latitude && formData.longitude
            ? {
                lat: formData.latitude,
                lng: formData.longitude,
              }
            : null
        }
      />
    </div>
  );
}

// ============================================
// SERVICES TAB COMPONENT
// ============================================
function ServicesTab({ providerProfile, fetchProviderProfile }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    hourly_rate: providerProfile?.hourly_rate || "",
    experience_years: providerProfile?.experience_years || "",
    availability: providerProfile?.availability || "available",
    description: providerProfile?.description || "",
    skills: providerProfile?.skills?.join(", ") || "",
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateErr } = await supabase
        .from("service_providers")
        .update({
          hourly_rate: parseFloat(formData.hourly_rate),
          experience_years: parseInt(formData.experience_years),
          availability: formData.availability,
          description: formData.description,
          skills: formData.skills
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s),
          updated_at: new Date().toISOString(),
        })
        .eq("id", providerProfile.id);

      if (updateErr) throw updateErr;

      setSuccess("Service details updated!");
      fetchProviderProfile();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Service Settings</h1>
          <p>Manage your service offerings</p>
        </div>
      </div>

      {success && (
        <div className="alert-success">
          <i className="bi bi-check-circle-fill"></i>
          {success}
        </div>
      )}

      {error && (
        <div className="alert-error">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {error}
        </div>
      )}

      <div className="settings-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Hourly Rate (₦)</label>
              <input
                type="number"
                name="hourly_rate"
                value={formData.hourly_rate}
                onChange={handleChange}
                placeholder="e.g., 3000"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Years of Experience</label>
              <input
                type="number"
                name="experience_years"
                value={formData.experience_years}
                onChange={handleChange}
                placeholder="e.g., 5"
                min="0"
              />
            </div>

            <div className="form-group full-width">
              <label>Availability Status</label>
              <div className="availability-options">
                {["available", "busy", "offline"].map((status) => (
                  <label
                    key={status}
                    className={`availability-option ${
                      formData.availability === status ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="availability"
                      value={status}
                      checked={formData.availability === status}
                      onChange={handleChange}
                    />
                    <span className={`status-indicator ${status}`}></span>
                    <span className="status-label">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group full-width">
              <label>Skills</label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleChange}
                placeholder="e.g., Wiring, Installation, Repair"
              />
              <span className="input-hint">Separate skills with commas</span>
            </div>

            <div className="form-group full-width">
              <label>Bio / Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                placeholder="Tell customers about your experience..."
                maxLength={500}
              ></textarea>
              <span className="input-hint">
                {formData.description.length}/500 characters
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-gradient btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================
// SECURITY TAB COMPONENT
// ============================================
function SecurityTab({ user }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.newPassword !== formData.confirmPassword) {
      return setError("Passwords do not match");
    }

    if (formData.newPassword.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setLoading(true);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateErr) throw updateErr;

      setSuccess("Password updated successfully!");
      setFormData({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content animate-fadeIn">
      <div className="content-header">
        <div>
          <h1>Security Settings</h1>
          <p>Manage your password and security</p>
        </div>
      </div>

      {success && (
        <div className="alert-success">
          <i className="bi bi-check-circle-fill"></i>
          {success}
        </div>
      )}

      {error && (
        <div className="alert-error">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {error}
        </div>
      )}

      <div className="settings-card">
        <h3 className="settings-section-title">Change Password</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>New Password</label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="Enter new password"
                minLength={6}
              />
            </div>

            <div className="form-group full-width">
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-gradient btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-sm"></span>
                Updating...
              </>
            ) : (
              <>
                <i className="bi bi-shield-lock me-2"></i>
                Update Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProviderDashboard;
