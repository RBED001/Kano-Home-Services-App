import { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";
import { Link } from "react-router-dom";
import '../styles/ServiceProviders.css';

function ServiceProviders() {
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [providerRatings, setProviderRatings] = useState({}); // NEW: Store calculated ratings

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [selectedCategory, sortBy]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
    } else {
      setCategories(data || []);
    }
  };

  // NEW: Fetch ratings for all providers
  const fetchProviderRatings = async (providerIds) => {
    if (!providerIds || providerIds.length === 0) return {};

    const { data, error } = await supabase
      .from("reviews")
      .select("provider_id, rating")
      .in("provider_id", providerIds);

    if (error) {
      console.error("Error fetching ratings:", error);
      return {};
    }

    if (data) {
      // Group reviews by provider_id and calculate average
      const ratingsMap = {};
      data.forEach((review) => {
        if (!ratingsMap[review.provider_id]) {
          ratingsMap[review.provider_id] = { sum: 0, count: 0 };
        }
        ratingsMap[review.provider_id].sum += review.rating;
        ratingsMap[review.provider_id].count += 1;
      });

      // Calculate averages
      const averages = {};
      Object.keys(ratingsMap).forEach((providerId) => {
        averages[providerId] = {
          rating: ratingsMap[providerId].sum / ratingsMap[providerId].count,
          count: ratingsMap[providerId].count
        };
      });

      return averages;
    }

    return {};
  };

  // Helper function to get provider rating
  const getProviderRating = (providerId) => {
    return providerRatings[providerId]?.rating || 0;
  };

  // Helper function to get review count
  const getReviewCount = (providerId) => {
    return providerRatings[providerId]?.count || 0;
  };

  const fetchProviders = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from("service_providers").select(`
          *,
          profiles(full_name, city, avatar_url, phone),
          service_categories(name)
        `);

      // Apply category filter
      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }

      // Apply sorting (for non-rating sorts)
      if (sortBy === "jobs") {
        query = query.order("total_jobs", { ascending: false });
      } else if (sortBy === "price_low") {
        query = query.order("hourly_rate", { ascending: true });
      } else if (sortBy === "price_high") {
        query = query.order("hourly_rate", { ascending: false });
      } else if (sortBy === "newest") {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching providers:", error);
        setError("Failed to load providers. Please try again.");
        setProviders([]);
      } else {
        console.log("Fetched providers:", data);
        
        // Fetch ratings for all providers
        if (data && data.length > 0) {
          const providerIds = data.map(p => p.id);
          const ratings = await fetchProviderRatings(providerIds);
          setProviderRatings(ratings);

          // If sorting by rating, sort client-side with calculated ratings
          if (sortBy === "rating") {
            const sortedData = [...data].sort((a, b) => {
              const ratingA = ratings[a.id]?.rating || 0;
              const ratingB = ratings[b.id]?.rating || 0;
              return ratingB - ratingA;
            });
            setProviders(sortedData);
          } else {
            setProviders(data);
          }
        } else {
          setProviders(data || []);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter providers by search term
  const filteredProviders = providers.filter((provider) => {
    if (!searchTerm.trim()) return true;

    const search = searchTerm.toLowerCase();
    const name = provider.profiles?.full_name?.toLowerCase() || "";
    const description = provider.description?.toLowerCase() || "";
    const category = provider.service_categories?.name?.toLowerCase() || "";
    const city = provider.profiles?.city?.toLowerCase() || "";
    const skills = provider.skills?.join(" ").toLowerCase() || "";

    return (
      name.includes(search) ||
      description.includes(search) ||
      category.includes(search) ||
      city.includes(search) ||
      skills.includes(search)
    );
  });

  const clearFilters = () => {
    setSelectedCategory("");
    setSearchTerm("");
    setSortBy("rating");
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

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    setShowFilters(false);
  };

  return (
    <div className="providers-page">
      {/* Hero Section */}
      <section className="providers-hero">
        <div className="container">
          <div className="text-center animate-fadeInUp">
            <h1 className="providers-hero-title">Find Service Providers</h1>
            <p className="providers-hero-subtitle">
              Browse through our verified artisans and book the perfect
              professional for your needs
            </p>
          </div>

          {/* Search Bar */}
          <div className="row justify-content-center mt-4">
            <div className="col-lg-8">
              <div className="search-container animate-fadeInUp stagger-1">
                <div className="input-group">
                  <span className="input-group-text bg-white border-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-0 shadow-none"
                    placeholder="Search by name, skill, or service..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      className="btn btn-link text-muted"
                      onClick={() => setSearchTerm("")}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  )}
                  <button
                    className="btn btn-primary d-lg-none"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <i className="bi bi-funnel"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section pt-4">
        <div className="container">
          <div className="row">
            {/* Filters Sidebar - Desktop */}
            <div className="col-lg-3 d-none d-lg-block">
              <div className="filter-card animate-fadeInLeft">
                <div className="filter-header">
                  <h5 className="mb-0">
                    <i className="bi bi-funnel me-2"></i>Filters
                  </h5>
                  {(selectedCategory || sortBy !== "rating") && (
                    <button
                      className="btn btn-link text-danger p-0"
                      onClick={clearFilters}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="filter-section">
                  <h6 className="filter-title">Category</h6>
                  <div className="category-filters">
                    <div
                      className={`category-filter-item ${
                        selectedCategory === "" ? "active" : ""
                      }`}
                      onClick={() => handleCategoryClick("")}
                    >
                      <i className="bi bi-grid-fill me-2"></i>
                      All Categories
                    </div>
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className={`category-filter-item ${
                          selectedCategory === cat.id ? "active" : ""
                        }`}
                        onClick={() => handleCategoryClick(cat.id)}
                      >
                        <i
                          className={`bi ${getCategoryIcon(cat.name)} me-2`}
                        ></i>
                        {cat.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sort Filter */}
                <div className="filter-section">
                  <h6 className="filter-title">Sort By</h6>
                  <select
                    className="form-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="rating">Highest Rated</option>
                    <option value="jobs">Most Jobs</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile Filter Overlay */}
            {showFilters && (
              <div className="filter-overlay d-lg-none">
                <div className="filter-card-mobile animate-fadeInUp">
                  <div className="filter-header">
                    <h5 className="mb-0">
                      <i className="bi bi-funnel me-2"></i>Filters
                    </h5>
                    <button
                      className="btn btn-link p-0"
                      onClick={() => setShowFilters(false)}
                    >
                      <i className="bi bi-x-lg fs-4"></i>
                    </button>
                  </div>

                  {/* Category Filter */}
                  <div className="filter-section">
                    <h6 className="filter-title">Category</h6>
                    <div className="category-filters">
                      <div
                        className={`category-filter-item ${
                          selectedCategory === "" ? "active" : ""
                        }`}
                        onClick={() => handleCategoryClick("")}
                      >
                        <i className="bi bi-grid-fill me-2"></i>
                        All Categories
                      </div>
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className={`category-filter-item ${
                            selectedCategory === cat.id ? "active" : ""
                          }`}
                          onClick={() => handleCategoryClick(cat.id)}
                        >
                          <i
                            className={`bi ${getCategoryIcon(cat.name)} me-2`}
                          ></i>
                          {cat.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sort Filter */}
                  <div className="filter-section">
                    <h6 className="filter-title">Sort By</h6>
                    <select
                      className="form-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="rating">Highest Rated</option>
                      <option value="jobs">Most Jobs</option>
                      <option value="price_low">Price: Low to High</option>
                      <option value="price_high">Price: High to Low</option>
                      <option value="newest">Newest First</option>
                    </select>
                  </div>

                  {/* Apply & Clear Buttons */}
                  <div className="filter-actions">
                    <button
                      className="btn btn-outline-secondary"
                      onClick={clearFilters}
                    >
                      Clear All
                    </button>
                    <button
                      className="btn btn-gradient"
                      onClick={() => setShowFilters(false)}
                    >
                      Show {filteredProviders.length} Results
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Providers List */}
            <div className="col-lg-9">
              {/* Results Header */}
              <div className="results-header animate-fadeInUp">
                <div className="results-count">
                  <strong>{filteredProviders.length}</strong> provider
                  {filteredProviders.length !== 1 ? "s" : ""} found
                  {selectedCategory && (
                    <span className="active-filter-badge">
                      {categories.find((c) => c.id === selectedCategory)?.name}
                      <i
                        className="bi bi-x-circle-fill ms-2"
                        onClick={() => setSelectedCategory("")}
                        style={{ cursor: "pointer" }}
                      ></i>
                    </span>
                  )}
                  {searchTerm && (
                    <span className="active-filter-badge">
                      "{searchTerm}"
                      <i
                        className="bi bi-x-circle-fill ms-2"
                        onClick={() => setSearchTerm("")}
                        style={{ cursor: "pointer" }}
                      ></i>
                    </span>
                  )}
                </div>
                <div className="d-none d-lg-block">
                  <select
                    className="form-select form-select-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ width: "auto" }}
                  >
                    <option value="rating">Highest Rated</option>
                    <option value="jobs">Most Jobs</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                  </select>
                </div>
              </div>

              {/* Error State */}
              {error && (
                <div className="alert alert-danger animate-fadeIn">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                  <button
                    className="btn btn-link text-danger"
                    onClick={fetchProviders}
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Loading State */}
              {loading ? (
                <div className="loading-container">
                  <div className="spinner-custom"></div>
                  <p className="mt-3 text-muted">Loading providers...</p>
                </div>
              ) : filteredProviders.length === 0 ? (
                /* Empty State */
                <div className="empty-state animate-fadeInUp">
                  <div className="empty-state-icon">
                    <i className="bi bi-search"></i>
                  </div>
                  <h4 className="empty-state-title">No providers found</h4>
                  <p className="empty-state-text">
                    {searchTerm || selectedCategory
                      ? "Try adjusting your search or filters to find what you're looking for."
                      : "There are no service providers registered yet. Be the first to join!"}
                  </p>
                  {(searchTerm || selectedCategory) && (
                    <button className="btn btn-gradient" onClick={clearFilters}>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                /* Providers Grid */
                <div className="row g-4">
                  {filteredProviders.map((provider, index) => (
                    <div key={provider.id} className="col-md-6 col-xl-4">
                      <div
                        className={`provider-card-new animate-fadeInUp stagger-${Math.min(
                          (index % 6) + 1,
                          5
                        )}`}
                      >
                        {/* Verified Badge */}
                        {provider.verified && (
                          <div
                            className="provider-verified-badge"
                            title="Verified Provider"
                          >
                            <i className="bi bi-patch-check-fill"></i>
                          </div>
                        )}

                        {/* Provider Header */}
                        <div className="provider-card-header">
                          {provider.profiles?.avatar_url ? (
                            <img
                              src={provider.profiles.avatar_url}
                              alt={provider.profiles.full_name || "Provider"}
                              className="provider-card-avatar"
                            />
                          ) : (
                            <div className="provider-card-avatar-placeholder">
                              {provider.profiles?.full_name
                                ?.charAt(0)
                                .toUpperCase() || "P"}
                            </div>
                          )}
                          <div className="provider-card-info">
                            <h5
                              className="provider-card-name"
                              title={provider.profiles?.full_name}
                            >
                              {provider.profiles?.full_name ||
                                "Service Provider"}
                            </h5>
                            <span className="provider-card-category">
                              <i
                                className={`bi ${getCategoryIcon(
                                  provider.service_categories?.name
                                )} me-1`}
                              ></i>
                              {provider.service_categories?.name ||
                                "General Services"}
                            </span>
                          </div>
                        </div>

                        {/* Rating & Jobs - FIXED */}
                        <div className="provider-card-stats">
                          <div className="provider-stat">
                            <i className="bi bi-star-fill text-warning"></i>
                            <span>{getProviderRating(provider.id).toFixed(1)}</span>
                            <small className="text-muted">
                              ({getReviewCount(provider.id)})
                            </small>
                          </div>
                          <div className="provider-stat">
                            <i className="bi bi-briefcase-fill text-primary"></i>
                            <span>{provider.total_jobs || 0}</span>
                          </div>
                          <div className="provider-stat">
                            <i className="bi bi-clock-fill text-success"></i>
                            <span>{provider.experience_years || 0}y</span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="provider-card-description">
                          {provider.description ||
                            "Professional service provider ready to help with your needs."}
                        </p>

                        {/* Location */}
                        <div className="provider-card-location">
                          <i className="bi bi-geo-alt-fill text-danger"></i>
                          <span>{provider.profiles?.city || "Kano"}</span>
                        </div>

                        {/* Skills Tags */}
                        {provider.skills && provider.skills.length > 0 ? (
                          <div className="provider-card-skills">
                            {provider.skills.slice(0, 3).map((skill, i) => (
                              <span key={i} className="skill-tag">
                                {skill}
                              </span>
                            ))}
                            {provider.skills.length > 3 && (
                              <span className="skill-tag more">
                                +{provider.skills.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="provider-card-skills"></div>
                        )}

                        {/* Footer */}
                        <div className="provider-card-footer">
                          <div className="provider-price">
                            <span className="price-amount">
                              ₦{(provider.hourly_rate || 0).toLocaleString()}
                            </span>
                            <span className="price-unit">/hr</span>
                          </div>
                          <Link
                            to={`/provider/${provider.id}`}
                            className="btn btn-gradient btn-sm"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ServiceProviders;