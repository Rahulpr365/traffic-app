// static/script.js

// Declare mapObjects globally accessible
let mapObjects = {};

// Function called by Google Maps API script after it loads
function initMap() {
    console.log("Google Maps API script loaded.");

    // Check if we are on the admin dashboard page
    // This check is needed because initMap is globally called by the Google script
    if (window.location.pathname === '/admin-dashboard') {
        initializeComplaintMaps();
        setupAdminStatusListeners(); // Also set up status listeners here
    }
}

// Function to initialize Google Maps for each complaint item on the dashboard
function initializeComplaintMaps() {
     // Find all map container divs that were rendered by Jinja2
    const mapContainers = document.querySelectorAll('.map-container');

    if (mapContainers.length > 0) {
        mapContainers.forEach(mapElement => {
            // Get latitude and longitude from the data attributes
            const lat = parseFloat(mapElement.dataset.lat);
            const lon = parseFloat(mapElement.dataset.lon);
            // Get the complaint ID from the div's ID
            const complaintId = mapElement.id.replace('map-', '');

            // Ensure coordinates are valid numbers and the Google Maps API object exists
            if (!isNaN(lat) && !isNaN(lon) && typeof google !== 'undefined' && google.maps) {
                try {
                    // Create a new Google Map instance for this div
                    const map = new google.maps.Map(mapElement, {
                        center: { lat: lat, lng: lon }, // Center the map on the coordinates
                        zoom: 15, // Default zoom level (adjust as needed)
                        disableDefaultUI: true, // Hide default controls for a cleaner look
                        zoomControl: true, // Keep zoom controls
                    });
                    // Add a marker at the complaint location
                    new google.maps.Marker({
                        position: { lat: lat, lng: lon },
                        map: map,
                        title: `Complaint ${complaintId} Location`, // Tooltip text for the marker
                    });
                    // Optionally store the map instance if you need to interact with it later
                    mapObjects[complaintId] = map;
                    console.log(`Map initialized for complaint ${complaintId}`);

                } catch (e) {
                    // Log and display an error if map initialization fails
                    console.error(`Error initializing map for complaint ${complaintId}:`, e);
                     mapElement.textContent = 'Error loading map.';
                }
            } else {
                 // Log a warning if coordinates are invalid or the API isn't fully ready
                 console.warn(`Skipping map initialization for complaint ${complaintId}. Invalid Lat/Lon or API not fully loaded.`);
                 mapElement.textContent = 'Invalid or missing coordinates for map.'; // Display message in div
            }
        });
        console.log(`Attempted map initialization for ${mapContainers.length} containers.`);
    } else {
        console.log("No map containers found to initialize maps.");
    }
}

// Function to set up status update event listeners on the admin dashboard
function setupAdminStatusListeners() {
    console.log("Setting up admin status listeners...");
    // Find all update buttons rendered by Jinja2
    const updateButtons = document.querySelectorAll('.update-status-btn');

    updateButtons.forEach(updateButton => {
        // Find parent complaint item to get complaint ID
        const itemElement = updateButton.closest('.dashboard-item');
        const complaintId = itemElement ? itemElement.dataset.complaintId : null;
        // Find the status select dropdown and status display span within this item
        const statusSelect = itemElement ? itemElement.querySelector('.status-select') : null;
        const statusSpan = itemElement ? itemElement.querySelector('.complaint-status') : null;


        if (complaintId && statusSelect && statusSpan) {
            // Add click listener to the Update button
            updateButton.addEventListener('click', async () => {
                const newStatus = statusSelect.value;
                console.log(`Attempting to update complaint ${complaintId} to status: ${newStatus}`);

                // Disable the button and show updating text during the request
                updateButton.disabled = true;
                updateButton.textContent = 'Updating...';

                 try {
                    // --- Make the AJAX call to the session-protected backend API ---
                    const response = await fetch(`/admin/api/complaints/${complaintId}/status`, {
                        method: 'PUT', // Use PUT method for updates
                        headers: {
                            'Content-Type': 'application/json' // Indicate sending JSON body
                            // DO NOT include X-API-Key header here - relies on session cookie
                        },
                        body: JSON.stringify({ status: newStatus }) // Send the new status as a JSON object
                    });

                    // Check the HTTP response status code
                    if (response.ok) { // response.ok is true for 2xx status codes
                        const result = await response.json(); // Parse the JSON response body
                        console.log('Status update success:', result.message);
                        statusSpan.textContent = result.new_status.capitalize(); // Update the displayed status on the page
                        alert(`Status updated for ${complaintId} to ${result.new_status}.`);
                    } else if (response.status === 401) {
                         // Handle 401 Unauthorized - means the admin session is invalid or expired
                         const result = await response.json();
                         console.error('Status update failed: Unauthorized', result.message);
                         alert('Unauthorized: Your admin session may have expired. Please log in again.');
                         // Optionally redirect to the login page
                         window.location.href = '/admin/login?next=' + encodeURIComponent(window.location.pathname); // Pass current path for redirection back

                    } else {
                        // Handle other non-2xx HTTP errors (e.g., 400 Bad Request, 404 Not Found, 500 Internal Server Error)
                        const result = await response.json(); // Attempt to parse JSON error body
                        console.error('Status update API Error:', response.status, result.message);
                        alert('Failed to update status: ' + (result.message || `Server error (Status: ${response.status})`));
                        // Reset the select dropdown back to the previous status if the update failed
                        statusSelect.value = statusSpan.textContent.toLowerCase();
                    }
                } catch (error) {
                     // Handle errors that occur during the fetch request itself (e.g., network issues, CORS problems)
                     console.error('Status update fetch error:', error);
                     alert('An error occurred while sending status update to the server.');
                     // Reset the select dropdown on fetch error
                     statusSelect.value = statusSpan.textContent.toLowerCase();
                } finally {
                    // Re-enable the update button and restore its text
                    updateButton.disabled = false;
                    updateButton.textContent = 'Update';
                }
            });
             // Add an event listener to the select dropdown
             statusSelect.addEventListener('change', () => {
                 // Disable the update button if the selected status is the same as the currently displayed status
                 updateButton.disabled = statusSelect.value.toLowerCase() === statusSpan.textContent.toLowerCase();
             });
             // Set the initial state of the update button based on the default selected value
             updateButton.disabled = statusSelect.value.toLowerCase() === statusSpan.textContent.toLowerCase();

        } else {
            console.error("Could not find necessary elements for status update on item:", itemElement);
        }
    });
    console.log(`Setup listeners for ${updateButtons.length} update buttons.`);
}

// Helper function to capitalize the first letter of a string
String.prototype.capitalize = function() {
    if (typeof this !== 'string' || this.length === 0) {
        return '';
    }
    return this.charAt(0).toUpperCase() + this.slice(1);
}


document.addEventListener('DOMContentLoaded', () => {
    // --- Auto-populate Date and Time on Load (Index page only) ---
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');

    if (dateInput && timeInput) { // Check if elements exist (on index page)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;
    }

    // --- Handle Fetch Location Button (Index page only) ---
    const fetchLocationBtn = document.getElementById('fetch-location-btn');
    const offenceLocationTextarea = document.getElementById('offence-location');
    const latInput = document.getElementById('latitude');
    const lonInput = document.getElementById('longitude');

    if (fetchLocationBtn && offenceLocationTextarea && latInput && lonInput) { // Check if elements exist
        fetchLocationBtn.addEventListener('click', () => {
            fetchLocationBtn.disabled = true;
            fetchLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';

            if (navigator.geolocation) { // Check if browser supports Geolocation API
                // Get the user's current position from the browser
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // Populate hidden lat/lon fields immediately
                    latInput.value = lat;
                    lonInput.value = lon;

                    try {
                        // Call the Flask backend /geocode route via AJAX
                        const response = await fetch('/geocode', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json' // Indicate sending JSON
                            },
                            body: JSON.stringify({ lat: lat, lon: lon }) // Send coordinates as JSON
                        });

                        // Parse the JSON response from the backend
                        const data = await response.json();

                        // Check if the backend reported success
                        if (data.success) {
                            // Populate the address textarea
                            offenceLocationTextarea.value = data.address;
                             console.log("Geolocation successful, address fetched:", data.address);

                        } else {
                            // Handle errors reported by the backend's geocode call
                            console.error('Backend Geocoding Error:', data.message);
                            alert('Could not fetch address: ' + (data.message || 'Unknown server error'));
                        }
                    } catch (error) {
                        // Handle errors during the fetch request to the backend
                        console.error('Error during geocoding fetch request:', error);
                        alert('An error occurred while contacting the server for address.');
                    } finally {
                        // Re-enable the button and restore its text/icon
                        fetchLocationBtn.disabled = false;
                        fetchLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Fetch Location';
                    }

                }, (error) => {
                    // --- Handle errors from the browser's navigator.geolocation API ---
                    console.error('Browser Geolocation Error:', error.message, error.code);
                    let errorMessage = 'Unable to retrieve your device location.';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location permission denied. Please allow location access in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'The request to get user location timed out.';
                            break;
                        default:
                            errorMessage = `An unknown geolocation error occurred (Code: ${error.code}).`;
                            break;
                    }
                    alert(errorMessage);

                    // Clear hidden lat/lon fields if browser geolocation fails
                    latInput.value = '';
                    lonInput.value = '';

                    fetchLocationBtn.disabled = false;
                    fetchLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Fetch Location';
                }, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            } else {
                alert('Geolocation is not supported by your browser.');
                 latInput.value = '';
                 lonInput.value = '';
                 fetchLocationBtn.disabled = false;
                 fetchLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Fetch Location';
            }
        });
    }

    // --- Handle File Upload Buttons (Index page only) ---
    const cameraButton = document.getElementById('camera-button');
    const videoButton = document.getElementById('video-button');
    const mediaUploadInput = document.getElementById('media-upload-input');

    if (cameraButton && videoButton && mediaUploadInput) {
        cameraButton.addEventListener('click', () => {
            mediaUploadInput.accept = 'image/*';
            mediaUploadInput.click();
        });

        videoButton.addEventListener('click', () => {
            mediaUploadInput.accept = 'video/*';
            mediaUploadInput.click();
        });

        mediaUploadInput.addEventListener('change', () => {
            const fileName = mediaUploadInput.files.length > 0 ? mediaUploadInput.files[0].name : 'No file selected';
            console.log('File selected:', fileName);
        });
    }


    // --- Handle Form Submission via AJAX (Index page only) ---
    const violationForm = document.getElementById('violation-form');

    if (violationForm) {
        violationForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const submitButton = violationForm.querySelector('.register-button');
            submitButton.disabled = true;
            submitButton.textContent = 'Registering...';

            const formData = new FormData(violationForm);

            try {
                const response = await fetch(violationForm.action, {
                    method: violationForm.method,
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    alert('Complaint registered successfully! Complaint ID: ' + result.complaint_id);
                    violationForm.reset();

                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    document.getElementById('date').value = `${year}-${month}-${day}`;
                    const hours = String(now.getHours()).padStart(2, '0');
                    const minutes = String(now.getMinutes()).padStart(2, '0');
                    document.getElementById('time').value = `${hours}:${minutes}`;

                    if (latInput && lonInput) {
                         latInput.value = '';
                         lonInput.value = '';
                    }

                } else {
                     const result = await response.json();
                     console.error('Submission HTTP Error:', response.status, result.message);
                     alert('Error registering complaint: ' + (result.message || `Server error (Status: ${response.status})`));
                }
            } catch (error) {
                console.error('Form submission failed:', error);
                alert('An error occurred during form submission.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Register';
            }
        });
    }

});

// initMap(), initializeComplaintMaps(), setupAdminStatusListeners() are defined outside DOMContentLoaded.
