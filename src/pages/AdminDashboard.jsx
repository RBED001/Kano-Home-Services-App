import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabaseClient'
import { useNavigate } from 'react-router-dom'
import styles from '../styles/AdminDashboard.module.css'

function AdminDashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  
  // ===== STATE MANAGEMENT =====
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  
  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProviders: 0,
    totalCustomers: 0,
    totalBookings: 0,
    pendingVerifications: 0,
    completedBookings: 0,
    activeBookings: 0,
    totalCategories: 0
  })
  
  // Data state
  const [users, setUsers] = useState([])
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  
  // Filter state
  const [userFilter, setUserFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Add category
const addCategory = async ({ name, description, icon_url }) => {
  try {
    const { error } = await supabase
      .from('service_categories')
      .insert([{ name, description, icon_url, created_at: new Date() }])
    if (error) throw error
    alert(`Category "${name}" added successfully!`)
    fetchCategories()
    fetchStats()
  } catch (err) {
    console.error('Error adding category:', err)
    alert('Failed to add category: ' + err.message)
  }
}

// Delete category
const deleteCategory = async (categoryId, categoryName) => {
  if (!confirm(`Are you sure you want to delete category "${categoryName}"?`)) return
  try {
    const { error } = await supabase
      .from('service_categories')
      .delete()
      .eq('id', categoryId)
    if (error) throw error
    alert(`Category "${categoryName}" deleted!`)
    fetchCategories()
    fetchStats()
  } catch (err) {
    console.error('Error deleting category:', err)
    alert('Failed to delete category: ' + err.message)
  }
}


  // ===== ACCESS CONTROL - Check if user is admin =====
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      alert('Access denied. Admin only.')
      navigate('/')
      return
    }
    
    if (profile?.role === 'admin') {
      fetchAllData()
    }
  }, [profile, navigate])

  // Early return if not admin to prevent rendering
  if (profile && profile.role !== 'admin') {
    return null
  }

  // ===== DATA FETCHING FUNCTIONS =====
  
  // Fetch all data
  const fetchAllData = async () => {
    setLoading(true)
    await Promise.all([
      fetchStats(),
      fetchUsers(),
      fetchProviders(),
      fetchCategories()
    ])
    setLoading(false)
  }

  // Fetch statistics
  const fetchStats = async () => {
    try {
      // Total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Total customers
      const { count: customersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer')

      // Total providers
      const { count: providersCount } = await supabase
        .from('service_providers')
        .select('*', { count: 'exact', head: true })

      // Pending verifications
      const { count: pendingCount } = await supabase
        .from('service_providers')
        .select('*', { count: 'exact', head: true })
        .eq('verified', false)

      // Total bookings
      const { count: bookingsCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })

      // Completed bookings
      const { count: completedCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')

      // Active bookings
      const { count: activeCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['accepted', 'in_progress'])

      // Total categories
      const { count: categoriesCount } = await supabase
        .from('service_categories')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalUsers: usersCount || 0,
        totalCustomers: customersCount || 0,
        totalProviders: providersCount || 0,
        pendingVerifications: pendingCount || 0,
        totalBookings: bookingsCount || 0,
        completedBookings: completedCount || 0,
        activeBookings: activeCount || 0,
        totalCategories: categoriesCount || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  // Fetch all providers
  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select(`
          *,
          profiles(full_name, phone, avatar_url, city),
          service_categories(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProviders(data || [])
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  // ===== ACTION FUNCTIONS =====

  // Delete user (customer or provider)
  const deleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This will delete all their data including bookings and messages.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error

      alert('User deleted successfully!')
      fetchUsers()
      fetchProviders()
      fetchStats()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user: ' + error.message)
    }
  }

  // Verify provider
  const verifyProvider = async (providerId, providerName) => {
    if (!confirm(`Verify ${providerName} as a trusted service provider?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('service_providers')
        .update({ verified: true })
        .eq('id', providerId)

      if (error) throw error

      alert('Provider verified successfully!')
      fetchProviders()
      fetchStats()
    } catch (error) {
      console.error('Error verifying provider:', error)
      alert('Error verifying provider: ' + error.message)
    }
  }

  // Unverify provider
  const unverifyProvider = async (providerId, providerName) => {
    if (!confirm(`Remove verification from ${providerName}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('service_providers')
        .update({ verified: false })
        .eq('id', providerId)

      if (error) throw error

      alert('Provider verification removed!')
      fetchProviders()
      fetchStats()
    } catch (error) {
      console.error('Error unverifying provider:', error)
      alert('Error: ' + error.message)
    }
  }

  // ===== FILTER LOGIC =====

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesFilter = userFilter === 'all' || u.role === userFilter
    const matchesSearch = searchTerm === '' || 
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm) ||
      u.city?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  // Filter providers
  const filteredProviders = providers.filter(p => {
    const matchesFilter = 
      providerFilter === 'all' || 
      (providerFilter === 'verified' && p.verified) ||
      (providerFilter === 'pending' && !p.verified)
    
    const matchesSearch = searchTerm === '' ||
      p.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.service_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.profiles?.city?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <div className={styles.adminLoading}>
        <div className={styles.spinnerCustom}></div>
        <p>Loading admin dashboard...</p>
      </div>
    )
  }

  // ===== MAIN RENDER =====
  return (
    <div className={styles.adminDashboardPage}>
      <div className={styles.adminContainer}>
        <div className={styles.adminRow}>
          
          {/* ===== SIDEBAR ===== */}
          <div className={styles.adminSidebar}>
            <div className={styles.sidebarContent}>
              
              {/* Admin Info */}
              <div className={`${styles.adminUserInfo} ${styles.animateFadeInLeft}`}>
                <div className={styles.adminAvatarLarge}>
                  <i className="bi bi-shield-lock-fill"></i>
                </div>
                <h5 className={styles.adminUsername}>{profile?.full_name}</h5>
                <p className={styles.adminUserRole}>
                  <i className="bi bi-patch-check-fill me-1"></i>
                  Administrator
                </p>
              </div>

              {/* Navigation */}
              <nav className={styles.adminNav}>
                <button
                  className={`${styles.adminNavItem} ${activeTab === 'overview' ? styles.active : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <i className="bi bi-grid-fill"></i>
                  <span>Overview</span>
                </button>
                
                <button
                  className={`${styles.adminNavItem} ${activeTab === 'users' ? styles.active : ''}`}
                  onClick={() => setActiveTab('users')}
                >
                  <i className="bi bi-people-fill"></i>
                  <span>All Users</span>
                  <span className={`badge bg-secondary rounded-pill ${styles.badgeAuto}`}>{stats.totalUsers}</span>
                </button>

                <button
                  className={`${styles.adminNavItem} ${activeTab === 'customers' ? styles.active : ''}`}
                  onClick={() => setActiveTab('customers')}
                >
                  <i className="bi bi-person-circle"></i>
                  <span>Customers</span>
                  <span className={`badge bg-info rounded-pill ${styles.badgeAuto}`}>{stats.totalCustomers}</span>
                </button>

                <button
                  className={`${styles.adminNavItem} ${activeTab === 'providers' ? styles.active : ''}`}
                  onClick={() => setActiveTab('providers')}
                >
                  <i className="bi bi-person-badge-fill"></i>
                  <span>Providers</span>
                  {stats.pendingVerifications > 0 && (
                    <span className={`badge bg-warning text-dark rounded-pill ${styles.badgeAuto} ${styles.pulseAnimation}`}>
                      {stats.pendingVerifications}
                    </span>
                  )}
                </button>
                <button
  className={`${styles.adminNavItem} ${activeTab === 'categories' ? styles.active : ''}`}
  onClick={() => setActiveTab('categories')}
>
  <i className="bi bi-tags-fill"></i>
  <span>Categories</span>
  <span className={`badge bg-secondary rounded-pill ${styles.badgeAuto}`}>{stats.totalCategories}</span>
</button>


                <button
                  className={`${styles.adminNavItem} ${activeTab === 'settings' ? styles.active : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <i className="bi bi-gear-fill"></i>
                  <span>Settings</span>
                </button>

                <hr />

                <button className={`${styles.adminNavItem} ${styles.textDanger}`} onClick={signOut}>
                  <i className="bi bi-box-arrow-right"></i>
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </div>

          {/* ===== MAIN CONTENT ===== */}
          <div className={styles.adminMain}>
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <OverviewTab stats={stats} setActiveTab={setActiveTab} styles={styles} />
            )}

            {/* All Users Tab */}
            {activeTab === 'users' && (
              <UsersTab
                users={users}
                currentUserId={user.id}
                deleteUser={deleteUser}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                styles={styles}
              />
            )}

            {/* Customers Tab */}
            {activeTab === 'customers' && (
              <CustomersTab
                users={filteredUsers.filter(u => u.role === 'customer')}
                currentUserId={user.id}
                deleteUser={deleteUser}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                styles={styles}
              />
            )}

            {/* Providers Tab */}
            {activeTab === 'providers' && (
              <ProvidersTab
                providers={filteredProviders}
                providerFilter={providerFilter}
                setProviderFilter={setProviderFilter}
                verifyProvider={verifyProvider}
                unverifyProvider={unverifyProvider}
                deleteUser={deleteUser}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                styles={styles}
              />
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <SettingsTab user={user} profile={profile} styles={styles} />
            )}

            {/* Categories Tab */}
{activeTab === 'categories' && (
  <CategoriesTab
    categories={categories}
    addCategory={addCategory}
    deleteCategory={deleteCategory}
    styles={styles}
  />
)}

          </div>
        </div>
      </div>
    </div>
  )
}

// ========================================
// ===== OVERVIEW TAB COMPONENT =====
// ========================================
function OverviewTab({ stats, setActiveTab, styles }) {
  return (
    <div className={styles.animateFadeInUp}>
      {/* Header */}
      <div className={styles.adminHeader}>
        <h2>
          <i className="bi bi-speedometer2 me-2"></i>
          Admin Dashboard
        </h2>
        <p className="text-muted">Platform overview and management</p>
      </div>

      {/* Main Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={`${styles.adminStatCard} ${styles.bgPrimary}`} onClick={() => setActiveTab('users')}>
          <div className={styles.statIcon}>
            <i className="bi bi-people-fill"></i>
          </div>
          <div className={styles.statDetails}>
            <div className={styles.statValue}>{stats.totalUsers}</div>
            <div className={styles.statLabel}>Total Users</div>
          </div>
          <i className={`bi bi-arrow-right ${styles.statArrow}`}></i>
        </div>

        <div className={`${styles.adminStatCard} ${styles.bgInfo}`} onClick={() => setActiveTab('customers')}>
          <div className={styles.statIcon}>
            <i className="bi bi-person-circle"></i>
          </div>
          <div className={styles.statDetails}>
            <div className={styles.statValue}>{stats.totalCustomers}</div>
            <div className={styles.statLabel}>Customers</div>
          </div>
          <i className={`bi bi-arrow-right ${styles.statArrow}`}></i>
        </div>

        <div className={`${styles.adminStatCard} ${styles.bgSuccess}`} onClick={() => setActiveTab('providers')}>
          <div className={styles.statIcon}>
            <i className="bi bi-person-badge-fill"></i>
          </div>
          <div className={styles.statDetails}>
            <div className={styles.statValue}>{stats.totalProviders}</div>
            <div className={styles.statLabel}>Service Providers</div>
          </div>
          <i className={`bi bi-arrow-right ${styles.statArrow}`}></i>
        </div>

        <div className={`${styles.adminStatCard} ${styles.bgWarning}`}>
          <div className={styles.statIcon}>
            <i className="bi bi-calendar-check-fill"></i>
          </div>
          <div className={styles.statDetails}>
            <div className={styles.statValue}>{stats.totalBookings}</div>
            <div className={styles.statLabel}>Total Bookings</div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className={styles.miniStatsGrid}>
        <div className={`${styles.miniStatCard} ${styles.warningCard}`}>
          <i className="bi bi-hourglass-split"></i>
          <div>
            <div className={styles.miniStatValue}>{stats.pendingVerifications}</div>
            <div className={styles.miniStatLabel}>Pending Verifications</div>
          </div>
        </div>

        <div className={`${styles.miniStatCard} ${styles.infoCard}`}>
          <i className="bi bi-gear-wide-connected"></i>
          <div>
            <div className={styles.miniStatValue}>{stats.activeBookings}</div>
            <div className={styles.miniStatLabel}>Active Bookings</div>
          </div>
        </div>

        <div className={`${styles.miniStatCard} ${styles.successCard}`}>
          <i className="bi bi-check-circle-fill"></i>
          <div>
            <div className={styles.miniStatValue}>{stats.completedBookings}</div>
            <div className={styles.miniStatLabel}>Completed</div>
          </div>
        </div>
      </div>

      {/* Alert for pending verifications */}
      {stats.pendingVerifications > 0 && (
        <div className={styles.adminAlertCard}>
          <div className={styles.alertIcon}>
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div className={styles.alertContent}>
            <h6>Action Required</h6>
            <p>You have {stats.pendingVerifications} provider(s) waiting for verification</p>
          </div>
          <button className="btn btn-warning" onClick={() => setActiveTab('providers')}>
            Review Now
          </button>
        </div>
      )}
    </div>
  )
}

// ========================================
// ===== ALL USERS TAB COMPONENT =====
// ========================================
function UsersTab({ users, currentUserId, deleteUser, searchTerm, setSearchTerm, styles }) {
  return (
    <div className={styles.animateFadeInUp}>
      {/* Header */}
      <div className={styles.adminHeader}>
        <h2>
          <i className="bi bi-people-fill me-2"></i>
          All Users
        </h2>
        <p className="text-muted">View and manage all registered users</p>
      </div>

      {/* Search Bar */}
      <div className={styles.adminSearchBar}>
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search by name, phone, or city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className={styles.clearSearch} onClick={() => setSearchTerm('')}>
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
      </div>

      {/* Users Grid */}
      <div className={styles.cardsGrid}>
        {users.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="bi bi-people"></i>
            <p>No users found</p>
          </div>
        ) : (
          users.map(userItem => (
            <div key={userItem.id} className={styles.userCard}>
              {/* Avatar */}
              <div className={styles.userCardHeader}>
                {userItem.avatar_url ? (
                  <img src={userItem.avatar_url} alt={userItem.full_name} className={styles.userAvatar} />
                ) : (
                  <div className={styles.userAvatarPlaceholder}>
                    {userItem.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className={`${styles.roleBadge} ${styles['role' + userItem.role?.charAt(0).toUpperCase() + userItem.role?.slice(1)]}`}>
                  {userItem.role}
                </span>
              </div>

              {/* User Info */}
              <div className={styles.userCardBody}>
                <h5>{userItem.full_name || 'Unnamed User'}</h5>
                <div className={styles.userDetails}>
                  <p><i className="bi bi-envelope"></i> {userItem.id.substring(0, 20)}...</p>
                  <p><i className="bi bi-telephone"></i> {userItem.phone || 'N/A'}</p>
                  <p><i className="bi bi-geo-alt"></i> {userItem.city || 'N/A'}</p>
                  <p><i className="bi bi-calendar"></i> {new Date(userItem.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.userCardFooter}>
                {userItem.id === currentUserId ? (
                  <span className="badge bg-info w-100">
                    <i className="bi bi-person-check me-1"></i>
                    You (Current Admin)
                  </span>
                ) : (
                  <button
                    className="btn btn-danger btn-sm w-100"
                    onClick={() => deleteUser(userItem.id, userItem.full_name)}
                  >
                    <i className="bi bi-trash me-2"></i>
                    Delete User
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ========================================
// ===== CUSTOMERS TAB COMPONENT =====
// ========================================
function CustomersTab({ users, currentUserId, deleteUser, searchTerm, setSearchTerm, styles }) {
  return (
    <div className={styles.animateFadeInUp}>
      {/* Header */}
      <div className={styles.adminHeader}>
        <h2>
          <i className="bi bi-person-circle me-2"></i>
          Customers
        </h2>
        <p className="text-muted">Manage customer accounts</p>
      </div>

      {/* Search Bar */}
      <div className={styles.adminSearchBar}>
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className={styles.clearSearch} onClick={() => setSearchTerm('')}>
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
      </div>

      {/* Customers Grid */}
      <div className={styles.cardsGrid}>
        {users.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="bi bi-person-circle"></i>
            <p>No customers found</p>
          </div>
        ) : (
          users.map(customer => (
            <div key={customer.id} className={styles.userCard}>
              <div className={styles.userCardHeader}>
                {customer.avatar_url ? (
                  <img src={customer.avatar_url} alt={customer.full_name} className={styles.userAvatar} />
                ) : (
                  <div className={styles.userAvatarPlaceholder}>
                    {customer.full_name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}
                <span className={`${styles.roleBadge} ${styles.roleCustomer}`}>Customer</span>
              </div>

              <div className={styles.userCardBody}>
                <h5>{customer.full_name || 'Unnamed Customer'}</h5>
                <div className={styles.userDetails}>
                  <p><i className="bi bi-telephone"></i> {customer.phone || 'N/A'}</p>
                  <p><i className="bi bi-geo-alt"></i> {customer.city || 'N/A'}</p>
                  <p><i className="bi bi-calendar"></i> Joined {new Date(customer.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className={styles.userCardFooter}>
                {customer.id === currentUserId ? (
                  <span className="badge bg-info w-100">You</span>
                ) : (
                  <button
                    className="btn btn-danger btn-sm w-100"
                    onClick={() => deleteUser(customer.id, customer.full_name)}
                  >
                    <i className="bi bi-trash me-2"></i>
                    Delete Customer
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
// ========================================
// ===== PROVIDERS TAB COMPONENT =====
// ========================================
function ProvidersTab({ 
  providers, 
  providerFilter, 
  setProviderFilter, 
  verifyProvider, 
  unverifyProvider,
  deleteUser,
  searchTerm,
  setSearchTerm,
  styles
}) {
  return (
    <div className={styles.animateFadeInUp}>
      {/* Header */}
      <div className={styles.adminHeader}>
        <h2>
          <i className="bi bi-person-badge-fill me-2"></i>
          Service Providers
        </h2>
        <p className="text-muted">Verify and manage service providers</p>
      </div>

      {/* Search Bar */}
      <div className={styles.adminSearchBar}>
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search providers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className={styles.clearSearch} onClick={() => setSearchTerm('')}>
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
      </div>

      {/* Filter Pills */}
      <div className={styles.filterPills}>
        <button
          className={`${styles.filterPill} ${providerFilter === 'all' ? styles.active : ''}`}
          onClick={() => setProviderFilter('all')}
        >
          All Providers
        </button>
        <button
          className={`${styles.filterPill} ${providerFilter === 'verified' ? styles.active : ''}`}
          onClick={() => setProviderFilter('verified')}
        >
          <i className="bi bi-patch-check-fill me-1"></i>
          Verified
        </button>
        <button
          className={`${styles.filterPill} ${providerFilter === 'pending' ? styles.active : ''}`}
          onClick={() => setProviderFilter('pending')}
        >
          <i className="bi bi-clock me-1"></i>
          Pending
        </button>
      </div>

      {/* Providers Grid */}
      <div className={styles.cardsGrid}>
        {providers.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="bi bi-person-badge"></i>
            <p>No providers found</p>
          </div>
        ) : (
          providers.map(provider => (
            <div key={provider.id} className={`${styles.providerCard} ${!provider.verified ? styles.pending : ''}`}>
              
              {/* Pending Badge */}
              {!provider.verified && (
                <div className={styles.pendingBadgeCorner}>
                  <i className="bi bi-clock"></i>
                </div>
              )}

              {/* Provider Header */}
              <div className={styles.providerCardHeader}>
                {provider.profiles?.avatar_url ? (
                  <img 
                    src={provider.profiles.avatar_url} 
                    alt={provider.profiles?.full_name} 
                    className={styles.providerAvatar}
                  />
                ) : (
                  <div className={styles.providerAvatarPlaceholder}>
                    {provider.profiles?.full_name?.charAt(0)?.toUpperCase() || 'P'}
                  </div>
                )}
                
                {provider.verified ? (
                  <span className={styles.verifiedBadge}>
                    <i className="bi bi-patch-check-fill"></i>
                    Verified
                  </span>
                ) : (
                  <span className={styles.pendingBadge}>
                    <i className="bi bi-hourglass-split"></i>
                    Pending
                  </span>
                )}
              </div>

              {/* Provider Body */}
              <div className={styles.providerCardBody}>
                <h5>{provider.profiles?.full_name || 'Unnamed Provider'}</h5>
                <span className={styles.categoryBadge}>
                  <i className="bi bi-tools me-1"></i>
                  {provider.service_categories?.name || 'General'}
                </span>

                <div className={styles.providerStats}>
                  <div className={styles.statItem}>
                    <i className="bi bi-star-fill text-warning"></i>
                    <span>{provider.rating?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className={styles.statItem}>
                    <i className="bi bi-briefcase"></i>
                    <span>{provider.total_jobs || 0} jobs</span>
                  </div>
                  <div className={styles.statItem}>
                    <i className="bi bi-currency-dollar"></i>
                    <span>₦{provider.hourly_rate || 0}/hr</span>
                  </div>
                </div>

                <div className={styles.providerInfo}>
                  <p><i className="bi bi-telephone"></i> {provider.profiles?.phone || 'N/A'}</p>
                  <p><i className="bi bi-geo-alt"></i> {provider.profiles?.city || 'N/A'}</p>
                </div>
              </div>

              {/* Provider Actions */}
              <div className={styles.providerCardFooter}>
                {provider.verified ? (
                  <>
                    <button
                      className="btn btn-outline-warning btn-sm"
                      onClick={() => unverifyProvider(provider.id, provider.profiles?.full_name)}
                    >
                      <i className="bi bi-x-circle me-1"></i>
                      Unverify
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteUser(provider.user_id, provider.profiles?.full_name)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => verifyProvider(provider.id, provider.profiles?.full_name)}
                    >
                      <i className="bi bi-check-circle me-1"></i>
                      Verify
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteUser(provider.user_id, provider.profiles?.full_name)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ========================================
// ===== SETTINGS TAB COMPONENT =====
// ========================================
function SettingsTab({ user, profile, styles }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Password form state
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return setError('Passwords do not match')
    }

    if (passwordData.newPassword.length < 6) {
      return setError('Password must be at least 6 characters')
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setSuccess('Password updated successfully!')
      setPasswordData({ newPassword: '', confirmPassword: '' })
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.animateFadeInUp}>
      {/* Header */}
      <div className={styles.adminHeader}>
        <h2>
          <i className="bi bi-gear-fill me-2"></i>
          Admin Settings
        </h2>
        <p className="text-muted">Manage your admin account</p>
      </div>

      <div className={styles.adminRow}>
        
        {/* Account Info Card */}
        <div className={styles.settingsCol}>
          <div className={styles.settingsCard}>
            <h5>
              <i className="bi bi-person-circle me-2"></i>
              Account Information
            </h5>
            <div className={styles.accountInfo}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Name</span>
                <span className={styles.infoValue}>{profile?.full_name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{user?.email}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Role</span>
                <span className={styles.infoValue}>
                  <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Administrator</span>
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Member Since</span>
                <span className={styles.infoValue}>
                  {new Date(profile?.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings Card */}
        <div className={styles.settingsCol}>
          <div className={styles.settingsCard}>
            <h5>
              <i className="bi bi-shield-lock me-2"></i>
              Security Settings
            </h5>

            {/* Success/Error Messages */}
            {success && (
              <div className="alert alert-success">
                <i className="bi bi-check-circle me-2"></i>
                {success}
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Password Change Form */}
            <form onSubmit={handlePasswordChange} className={styles.settingsForm}>
              <div className={styles.formGroup}>
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="Enter new password"
                  required
                  minLength="6"
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                  required
                  minLength="6"
                  disabled={loading}
                />
              </div>

              <div className={styles.infoNote}>
                <i className="bi bi-info-circle me-2"></i>
                Password must be at least 6 characters long
              </div>

              <button type="submit" className="btn btn-gradient" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Updating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check me-2"></i>
                    Update Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}


//========================================
// ===== categories TAB COMPONENT =====
// ========================================
function CategoriesTab({ categories, addCategory, deleteCategory, styles }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!name) return alert('Category name is required')
    setLoading(true)
    await addCategory({ name, description, icon_url: iconUrl })
    setName(''); setDescription(''); setIconUrl('')
    setLoading(false)
  }

  return (
    <div className={styles.animateFadeInUp}>
      <div className={styles.adminHeader}>
        <h2><i className="bi bi-tags-fill me-2"></i>Service Categories</h2>
        <p className="text-muted">Add, view, and manage service categories</p>
      </div>

      {/* Add Category Form */}
      <form className={styles.categoryForm} onSubmit={handleAddCategory}>
        <input type="text" placeholder="Category Name" value={name} onChange={e => setName(e.target.value)} required />
        <input type="text" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <input type="text" placeholder="Icon URL" value={iconUrl} onChange={e => setIconUrl(e.target.value)} />
        <button type="submit" className="btn btn-success" disabled={loading}>
          {loading ? 'Adding...' : 'Add Category'}
        </button>
      </form>

      {/* Categories List */}
      <div className={styles.cardsGrid}>
        {categories.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="bi bi-tags"></i>
            <p>No categories found</p>
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat.id} className={styles.categoryCard}>
              <div className={styles.categoryInfo}>
                {cat.icon_url && <img src={cat.icon_url} alt={cat.name} className={styles.categoryIcon} />}
                <div>
                  <h5>{cat.name}</h5>
                  <p>{cat.description}</p>
                </div>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => deleteCategory(cat.id, cat.name)}
              >
                <i className="bi bi-trash"></i> Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ========================================
// ===== EXPORT DEFAULT =====
// ========================================
export default AdminDashboard