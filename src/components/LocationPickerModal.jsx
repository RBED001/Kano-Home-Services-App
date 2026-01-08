import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './LocationPickerModal.css'

// Custom magenta marker
const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// LocationMarker Component
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? <Marker position={position} icon={customIcon} /> : null;
}

// RecenterMap Component
function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && position.length === 2) {
      map.setView(position, 15);
    }
  }, [position, map]);
  return null;
}

// Main LocationPickerModal Component
function LocationPickerModal({ isOpen, onClose, onSelectLocation, initialPosition }) {
  const [position, setPosition] = useState(
    initialPosition ? [initialPosition.lat, initialPosition.lng] : null
  );
  const [address, setAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Default to Kano, Nigeria
  const defaultCenter = [12.0022, 8.5920];
  const mapCenter = position || defaultCenter;

  // Get current location
  const getCurrentLocation = () => {
    setLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const newPos = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
          setLoadingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please select manually on the map.');
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setLoadingLocation(false);
    }
  };

  // Reverse geocode to get address from coordinates
  const reverseGeocode = async (pos) => {
    if (!pos || pos.length !== 2) return;
    
    setGeocoding(true);
    
    try {
      const [lat, lng] = pos;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'KHSA-App'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        const fallbackAddress = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        setAddress(fallbackAddress);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      const [lat, lng] = pos;
      const fallbackAddress = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
      setAddress(fallbackAddress);
    } finally {
      setGeocoding(false);
    }
  };

  // Search for location
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Kano, Nigeria')}&limit=1`,
        {
          headers: {
            'User-Agent': 'KHSA-App'
          }
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const newPos = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setPosition(newPos);
        setAddress(data[0].display_name);
      } else {
        alert('Location not found. Try a different search term.');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      alert('Error searching location. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Handle marker position change
  useEffect(() => {
    if (position && position.length === 2) {
      setAddress('');
      reverseGeocode(position);
    }
  }, [position?.[0], position?.[1]]);

  const handleConfirm = () => {
    if (position && address) {
      const [lat, lng] = position;
      onSelectLocation({
        position: { lat, lng },
        address
      });
      onClose();
    } else {
      alert('Please select a location on the map');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="location-picker-modal-wrapper">
      <div className="lp-overlay" onClick={onClose}>
        <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="lp-header">
            <div className="lp-header-content">
              <i className="bi bi-geo-alt-fill"></i>
              <h3>Select Location</h3>
            </div>
            <button className="lp-close-btn" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* Two Column Body */}
          <div className="lp-body">
            {/* LEFT SIDE - Map */}
            <div className="lp-map-column">
              <div className="lp-map-wrapper">
                <MapContainer
                  center={mapCenter}
                  zoom={13}
                  style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
                  scrollWheelZoom={false}
                  doubleClickZoom={true}
                  key={`map-${mapCenter[0]}-${mapCenter[1]}`}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker position={position} setPosition={setPosition} />
                  <RecenterMap position={position} />
                </MapContainer>
              </div>
              <div className="lp-map-hint">
                <i className="bi bi-hand-index"></i>
                <span>Click to select</span>
              </div>
            </div>

            {/* RIGHT SIDE - Controls */}
            <div className="lp-controls-column">
              <div className="lp-controls-content">
                {/* Search */}
                <div className="lp-section">
                  <label className="lp-label">
                    <i className="bi bi-search"></i>
                    Search
                  </label>
                  <div className="lp-search-group">
                    <input
                      type="text"
                      placeholder="Enter location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
                    />
                    <button 
                      className="lp-search-btn"
                      onClick={searchLocation}
                      disabled={searching}
                    >
                      {searching ? (
                        <span className="lp-spinner"></span>
                      ) : (
                        <i className="bi bi-search"></i>
                      )}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="lp-divider"><span>OR</span></div>

                {/* GPS */}
                <div className="lp-section">
                  <label className="lp-label">
                    <i className="bi bi-crosshair"></i>
                    GPS
                  </label>
                  <button 
                    className="lp-gps-btn"
                    onClick={getCurrentLocation}
                    disabled={loadingLocation}
                  >
                    {loadingLocation ? (
                      <>
                        <span className="lp-spinner"></span>
                        Getting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-geo-alt"></i>
                        Use Current Location
                      </>
                    )}
                  </button>
                </div>

                <div className="lp-divider"></div>

                {/* Address Display */}
                <div className="lp-section">
                  <label className="lp-label">
                    <i className="bi bi-pin-map-fill"></i>
                    Selected
                  </label>
                  
                  {geocoding ? (
                    <div className="lp-address-loading">
                      <span className="lp-spinner"></span>
                      <span>Loading...</span>
                    </div>
                  ) : address ? (
                    <div className="lp-address-display">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>{address}</span>
                    </div>
                  ) : position ? (
                    <div className="lp-address-loading">
                      <span className="lp-spinner"></span>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    <div className="lp-no-address">
                      <i className="bi bi-info-circle"></i>
                      <span>No location selected</span>
                    </div>
                  )}
                </div>

                {/* Coordinates */}
                {position && (
                  <div className="lp-coords">
                    <small>
                      <i className="bi bi-geo"></i>
                      {position[0].toFixed(4)}, {position[1].toFixed(4)}
                    </small>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="lp-footer">
                <button className="lp-btn-cancel" onClick={onClose}>
                  <i className="bi bi-x-lg"></i>
                  Cancel
                </button>
                <button 
                  className="lp-btn-confirm"
                  onClick={handleConfirm}
                  disabled={!position || !address || geocoding}
                >
                  {geocoding ? (
                    <>
                      <span className="lp-spinner"></span>
                      Wait...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill"></i>
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LocationPickerModal;