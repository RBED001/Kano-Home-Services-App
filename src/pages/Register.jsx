import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Register.css";

function Register() {
  const [step, setStep] = useState(1); // Step 1: Role selection, Step 2: Form
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    phone: "",
    role: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError("");
  };

  const selectRole = (role) => {
    setFormData({ ...formData, role });
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.full_name.trim()) {
      return setError("Full name is required");
    }

    if (!formData.email.trim()) {
      return setError("Email is required");
    }

    if (!formData.phone.trim()) {
      return setError("Phone number is required");
    }

    if (formData.password.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    const { data, error } = await signUp(formData.email, formData.password, {
      full_name: formData.full_name,
      role: formData.role,
      phone: formData.phone,
    });

    if (error) {
      setLoading(false);

      console.log("Registration error:", error);

      if (
        error.message.includes("User already registered") ||
        error.message.includes("already registered") ||
        error.message.includes("already exists") ||
        error.message.includes("duplicate key") ||
        error.code === "23505" ||
        error.code === "user_already_exists"
      ) {
        setError(
          "An account with this email already exists. Please login instead."
        );
      } else if (error.message.includes("Invalid email")) {
        setError("Please enter a valid email address");
      } else if (error.message.includes("Password")) {
        setError("Password must be at least 6 characters");
      } else if (error.message.includes("rate limit")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(error.message || "Registration failed. Please try again.");
      }
    } else {
      setLoading(false);
      setShowSuccessModal(true);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigate("/login");
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-10 col-lg-8">
            {/* Step 1: Role Selection */}
            {step === 1 && (
              <div className="animate-fadeInUp">
                <div className="text-center mb-5">
                  <Link to="/" className="text-decoration-none">
                    <i className="bi bi-house-gear fs-1 text-primary"></i>
                    <h2 className="mt-2 text-dark">Join KHSA</h2>
                  </Link>
                  <p className="text-muted">How would you like to use KHSA?</p>
                </div>

                <div className="row g-4 justify-content-center">
                  {/* Customer Card */}
                  <div className="col-md-6">
                    <div
                      className="role-card"
                      onClick={() => selectRole("customer")}
                    >
                      <div className="role-card-icon customer">
                        <i className="bi bi-person-fill"></i>
                      </div>
                      <h4 className="role-card-title">I need services</h4>
                      <p className="role-card-text">
                        Find and hire trusted artisans for your home service
                        needs
                      </p>
                      <ul className="role-card-features">
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Browse verified providers
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Book services easily
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Chat with artisans
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Rate and review
                        </li>
                      </ul>
                      <button className="btn btn-gradient w-100 mt-3">
                        Continue as Customer{" "}
                        <i className="bi bi-arrow-right ms-2"></i>
                      </button>
                    </div>
                  </div>

                  {/* Provider Card */}
                  <div className="col-md-6">
                    <div
                      className="role-card"
                      onClick={() => selectRole("provider")}
                    >
                      <div className="role-card-icon provider">
                        <i className="bi bi-tools"></i>
                      </div>
                      <h4 className="role-card-title">I provide services</h4>
                      <p className="role-card-text">
                        Join as an artisan and get more customers for your
                        skills
                      </p>
                      <ul className="role-card-features">
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Create your profile
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Receive job requests
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Grow your business
                        </li>
                        <li>
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          Get verified badge
                        </li>
                      </ul>
                      <button className="btn btn-outline-gradient w-100 mt-3">
                        Continue as Provider{" "}
                        <i className="bi bi-arrow-right ms-2"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-4">
                  <p className="text-muted">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary fw-semibold">
                      Login here
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Registration Form */}
            {step === 2 && (
              <div className="row justify-content-center">
                <div className="col-md-8 col-lg-6">
                  <div className="auth-card animate-fadeInUp">
                    <div className="auth-header">
                      <div className="text-center">
                        <div className={`role-badge ${formData.role}`}>
                          <i
                            className={`bi ${
                              formData.role === "customer"
                                ? "bi-person-fill"
                                : "bi-tools"
                            } me-2`}
                          ></i>
                          {formData.role === "customer"
                            ? "Customer"
                            : "Service Provider"}
                        </div>
                        <h2 className="auth-title mt-3">Create Account</h2>
                        <p className="auth-subtitle">
                          Fill in your details to get started
                        </p>
                      </div>
                    </div>

                    <div className="auth-body">
                      {error && (
                        <div
                          className="alert alert-danger alert-dismissible fade show animate-fadeIn"
                          role="alert"
                        >
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          {error}
                          <button
                            type="button"
                            className="btn-close"
                            onClick={() => setError("")}
                          ></button>
                        </div>
                      )}

                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="form-label-custom">
                            Full Name <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-person"></i>
                            </span>
                            <input
                              type="text"
                              className="form-control form-control-custom"
                              name="full_name"
                              value={formData.full_name}
                              onChange={handleChange}
                              placeholder="Enter your full name"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="form-label-custom">
                            Email Address <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-envelope"></i>
                            </span>
                            <input
                              type="email"
                              className="form-control form-control-custom"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="your@email.com"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="form-label-custom">
                            Phone Number <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-telephone"></i>
                            </span>
                            <input
                              type="tel"
                              className="form-control form-control-custom"
                              name="phone"
                              value={formData.phone}
                              onChange={handleChange}
                              placeholder="080XXXXXXXX"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="form-label-custom">
                            Password <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-lock"></i>
                            </span>
                            <input
                              type={showPassword ? "text" : "password"}
                              className="form-control form-control-custom"
                              name="password"
                              value={formData.password}
                              onChange={handleChange}
                              placeholder="Minimum 6 characters"
                              required
                              disabled={loading}
                            />
                            <button
                              type="button"
                              className="input-group-text password-toggle"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                            >
                              <i
                                className={`bi ${
                                  showPassword ? "bi-eye-slash" : "bi-eye"
                                }`}
                              ></i>
                            </button>
                          </div>
                          <small className="text-muted">
                            Password must be at least 6 characters
                          </small>
                        </div>

                        <div className="mb-4">
                          <label className="form-label-custom">
                            Confirm Password{" "}
                            <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">
                              <i className="bi bi-lock-fill"></i>
                            </span>
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              className="form-control form-control-custom"
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={handleChange}
                              placeholder="Re-enter your password"
                              required
                              disabled={loading}
                            />
                            <button
                              type="button"
                              className="input-group-text password-toggle"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              tabIndex={-1}
                            >
                              <i
                                className={`bi ${
                                  showConfirmPassword
                                    ? "bi-eye-slash"
                                    : "bi-eye"
                                }`}
                              ></i>
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="btn btn-gradient w-100 mb-3"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                              ></span>
                              Creating Account...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-person-plus me-2"></i>
                              Create Account
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-secondary w-100"
                          onClick={goBack}
                          disabled={loading}
                        >
                          <i className="bi bi-arrow-left me-2"></i>
                          Change Role
                        </button>

                        <div className="text-center mt-4">
                          <p className="text-muted mb-0">
                            Already have an account?{" "}
                            <Link
                              to="/login"
                              className="text-primary fw-semibold"
                            >
                              Login here
                            </Link>
                          </p>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay animate-fadeIn">
          <div className="success-modal animate-bounceIn">
            <div className="success-icon">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h3>Registration Successful!</h3>
            <p className="text-muted">
              Your account has been created successfully.
              {formData.role === "provider" && (
                <span> Complete your provider profile after logging in.</span>
              )}
            </p>
            <button
              className="btn btn-gradient btn-lg w-100"
              onClick={handleSuccessClose}
            >
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Continue to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;
