document.addEventListener('DOMContentLoaded', function() {
    const locationInput = document.getElementById('locationInput');
    const suggestionsList = document.getElementById('suggestionsList');
    const getForecastButton = document.getElementById('getForecastButton');
    const daysInput = document.getElementById('daysInput');
    const forecastImage = document.getElementById('forecastImage');
    const imagePlaceholderText = document.getElementById('imagePlaceholderText');

    let selectedLat = null;
    let selectedLon = null;
    let debounceTimer;

    // --- Autocomplete Logic (Photon API) ---
    locationInput.addEventListener('input', function() {
        const query = this.value.trim();
        clearTimeout(debounceTimer);
        
        // Reset selection if user types again
        selectedLat = null; 
        selectedLon = null;
        getForecastButton.disabled = true;

        if (query.length < 3) {
            suggestionsList.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            // Photon is a free, open-source geocoder based on OpenStreetMap
            fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`)
                .then(response => response.json())
                .then(data => {
                    suggestionsList.innerHTML = '';
                    if (data.features && data.features.length > 0) {
                        data.features.forEach(feature => {
                            const li = document.createElement('li');
                            const props = feature.properties;
                            
                            // Construct a readable label
                            let label = props.name;
                            if (props.city && props.city !== props.name) label += `, ${props.city}`;
                            if (props.state) label += `, ${props.state}`;
                            if (props.country) label += `, ${props.country}`;
                            
                            li.textContent = label;
                            li.addEventListener('click', () => {
                                locationInput.value = label;
                                selectedLat = feature.geometry.coordinates[1];
                                selectedLon = feature.geometry.coordinates[0];
                                suggestionsList.style.display = 'none';
                                getForecastButton.disabled = false;
                            });
                            suggestionsList.appendChild(li);
                        });
                        suggestionsList.style.display = 'block';
                    } else {
                        suggestionsList.style.display = 'none';
                    }
                })
                .catch(err => console.error("Geocoding error:", err));
        }, 300); // Wait 300ms after typing stops
    });

    // Hide suggestions if clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== locationInput && e.target !== suggestionsList) {
            suggestionsList.style.display = 'none';
        }
    });

    // --- Plot Fetching Logic ---
    getForecastButton.addEventListener('click', function() {
        if (!selectedLat || !selectedLon) return;

        const days = daysInput.value;
        
        // IMPORTANT: Ensure this URL matches your PythonAnywhere config
        // New Endpoint: /stavrocast/plot
        const baseUrl = 'http://StaviMondavi.pythonanywhere.com'; 
        const plotUrl = `${baseUrl}/stavrocast/plot?lat=${selectedLat}&lon=${selectedLon}&days=${days}`;

        imagePlaceholderText.textContent = 'Generating custom ECMWF forecast... this takes about 5-10 seconds.';
        imagePlaceholderText.style.display = 'block';
        forecastImage.style.display = 'none';
        forecastImage.src = '';

        const tempImg = new Image();
        tempImg.onload = function() {
            forecastImage.src = plotUrl;
            forecastImage.style.display = 'block';
            imagePlaceholderText.style.display = 'none';
        };
        tempImg.onerror = function() {
            imagePlaceholderText.textContent = 'Error loading forecast. Please try again or choose a different location.';
        };
        // Trigger the load
        tempImg.src = plotUrl;
    });
});