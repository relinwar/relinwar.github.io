'use strict';

const singaporeCenter = [1.3521, 103.8198];
const defaultZoom = 13;
const favoritesStorageKey = 'hawker-hunt-favorites';
const appConfig = window.HAWKER_HUNT_CONFIG || {};
const apiBaseUrl = (appConfig.API_BASE_URL || '').replace(/\/$/, '');

const defaultFilter = {
  mode: 'nearby',
  includedType: 'restaurant',
  textQuery: '',
  label: 'Top food spots',
  radius: 1200,
  sort: 'DISTANCE',
  priceLevel: '',
  openNow: false,
};

const state = {
  map: null,
  userMarker: null,
  placeMarkers: [],
  routeLayer: null,
  routeData: null,
  places: [],
  selectedPlaceId: null,
  selectedPlace: null,
  userLocation: null,
  routeMode: 'walk',
  roundTrip: false,
  profile: {
    weightKg: 70,
    age: 30,
  },
  filters: { ...defaultFilter },
  favorites: loadFavorites(),
};

const el = {
  locateBtn: document.getElementById('locateBtn'),
  scanBtn: document.getElementById('scanBtn'),
  resetBtn: document.getElementById('resetBtn'),
  radiusSelect: document.getElementById('radiusSelect'),
  sortSelect: document.getElementById('sortSelect'),
  openNowCheckbox: document.getElementById('openNowCheckbox'),
  weightInput: document.getElementById('weightInput'),
  ageInput: document.getElementById('ageInput'),
  filtersToggle: document.getElementById('filtersToggle'),
  resultsToggle: document.getElementById('resultsToggle'),
  savedToggle: document.getElementById('savedToggle'),
  priceFilters: document.getElementById('priceFilters'),
  cuisineFilters: document.getElementById('cuisineFilters'),
  resultsList: document.getElementById('resultsList'),
  resultsTitle: document.getElementById('resultsTitle'),
  resultCount: document.getElementById('resultCount'),
  savedCount: document.getElementById('savedCount'),
  savedList: document.getElementById('savedList'),
  statusBanner: document.getElementById('statusBanner'),
  locationLabel: document.getElementById('locationLabel'),
  apiStatus: document.getElementById('apiStatus'),
  detailsDrawer: document.getElementById('detailsDrawer'),
  drawerTitle: document.getElementById('drawerTitle'),
  drawerMeta: document.getElementById('drawerMeta'),
  drawerMapsLink: document.getElementById('drawerMapsLink'),
  routeSummary: document.getElementById('routeSummary'),
  routeModeGroup: document.getElementById('routeModeGroup'),
  routeBtn: document.getElementById('routeBtn'),
  clearRouteBtn: document.getElementById('clearRouteBtn'),
  walkModeBtn: document.getElementById('walkModeBtn'),
  jogModeBtn: document.getElementById('jogModeBtn'),
  roundTripBtn: document.getElementById('roundTripBtn'),
  reviewStack: document.getElementById('reviewStack'),
};

init();

async function init() {
  initMap();
  bindEvents();
  renderSavedPlaces();
  applyPanelState('filters', true);
  applyPanelState('results', false);
  applyPanelState('saved', false);
  await checkApiStatus();
}

function initMap() {
  state.map = L.map('map', {
    zoomControl: false,
    minZoom: 11,
  }).setView(singaporeCenter, defaultZoom);

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(state.map);

  state.map.on('click', event => {
    const { lat, lng } = event.latlng;
    state.userLocation = { lat, lng };
    updateUserMarker();
    el.locationLabel.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    el.apiStatus.textContent = 'Manual location selected';
    setStatus('Pinned a custom search location from the map. Refresh nearby when ready.', 'success');
  });
}

function bindEvents() {
  el.locateBtn.addEventListener('click', () => requestUserLocation({ autoScan: true }));
  el.scanBtn.addEventListener('click', scanNearbyPlaces);
  el.resetBtn.addEventListener('click', resetFilters);
  el.radiusSelect.addEventListener('change', event => {
    state.filters.radius = Number(event.target.value);
    refreshNearbyIfReady();
  });
  el.sortSelect.addEventListener('change', event => {
    state.filters.sort = event.target.value;
    refreshNearbyIfReady();
  });
  el.openNowCheckbox.addEventListener('change', event => {
    state.filters.openNow = event.target.checked;
    refreshNearbyIfReady();
  });
  el.weightInput.addEventListener('change', event => {
    state.profile.weightKg = clampValue(Number(event.target.value), 20, 250, 70);
    event.target.value = String(state.profile.weightKg);
    if (state.routeData) renderRouteSummary(state.routeData.distance);
  });
  el.ageInput.addEventListener('change', event => {
    state.profile.age = clampValue(Number(event.target.value), 10, 100, 30);
    event.target.value = String(state.profile.age);
    if (state.routeData) renderRouteSummary(state.routeData.distance);
  });
  el.filtersToggle.addEventListener('click', () => togglePanel('filters'));
  el.resultsToggle.addEventListener('click', () => togglePanel('results'));
  el.savedToggle.addEventListener('click', () => togglePanel('saved'));
  el.routeBtn.addEventListener('click', showRouteToSelectedPlace);
  el.clearRouteBtn.addEventListener('click', clearRoute);
  el.routeModeGroup.addEventListener('click', event => {
    const modeButton = event.target.closest('[data-route-mode]');
    if (modeButton) {
      state.routeMode = modeButton.dataset.routeMode;
      syncRouteModeButtons();
      if (state.routeData) renderRouteSummary(state.routeData.distance);
      return;
    }

    const roundTripButton = event.target.closest('[data-round-trip]');
    if (roundTripButton) {
      state.roundTrip = !state.roundTrip;
      syncRouteModeButtons();
      if (state.routeData) renderRouteSummary(state.routeData.distance);
    }
  });

  el.priceFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-price]');
    if (!button) return;
    state.filters.priceLevel = button.dataset.price;
    syncActiveChip(el.priceFilters, button, '[data-price]');
    refreshNearbyIfReady();
  });

  el.cuisineFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;

    state.filters.mode = button.dataset.mode;
    state.filters.includedType = button.dataset.type || 'restaurant';
    state.filters.textQuery = button.dataset.query || '';
    state.filters.label = button.dataset.label || 'Food picks';
    syncActiveChip(el.cuisineFilters, button, '[data-mode]');
    refreshNearbyIfReady();
  });

  el.resultsList.addEventListener('click', event => {
    const favoriteButton = event.target.closest('[data-favorite-place-id]');
    if (favoriteButton) {
      event.stopPropagation();
      toggleFavoriteById(favoriteButton.dataset.favoritePlaceId);
    }
  });

  el.savedList.addEventListener('click', event => {
    const jumpButton = event.target.closest('[data-jump-place-id]');
    if (jumpButton) {
      const placeId = jumpButton.dataset.jumpPlaceId;
      const place =
        state.places.find(item => item.id === placeId) ||
        state.favorites.find(item => item.id === placeId);

      if (place?.location) {
        state.map.flyTo([place.location.latitude, place.location.longitude], 16, {
          duration: 0.8,
        });
      }

      if (state.places.some(item => item.id === placeId)) {
        selectPlace(placeId, false);
      }
      return;
    }

    const removeButton = event.target.closest('[data-remove-place-id]');
    if (removeButton) {
      removeFavorite(removeButton.dataset.removePlaceId);
    }
  });
}

async function checkApiStatus() {
  try {
    const response = await fetch(buildApiUrl('/api/config'));
    const config = await response.json();

    if (config.configured) {
      setStatus('Google Places connected. Ready to search nearby food.', 'success');
      el.apiStatus.textContent = 'Places API connected';
    } else {
      setStatus(
        'Add GOOGLE_MAPS_API_KEY on the backend, then restart the server to load live places.',
        'warning'
      );
      el.apiStatus.textContent = 'API key missing';
    }
  } catch (error) {
    setStatus(
      'Could not reach the API server. Set site-config.js if the backend lives on another domain.',
      'error'
    );
    el.apiStatus.textContent = 'Server offline';
  }
}

function requestUserLocation(options = {}) {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported in this browser.', 'error');
    return;
  }

  setStatus('Finding your location in Singapore...', 'loading');

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      state.userLocation = { lat: latitude, lng: longitude };

      updateUserMarker();
      state.map.flyTo([latitude, longitude], 15, { duration: 1.2 });

      el.locationLabel.textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      el.apiStatus.textContent = 'Location ready';
      setStatus('Location locked in. Pulling nearby food spots next.', 'success');

      if (options.autoScan) {
        scanNearbyPlaces();
      }
    },
    () => {
      setStatus(
        'Location access was denied. You can still browse once location is enabled.',
        'error'
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
    }
  );
}

function updateUserMarker() {
  if (!state.userLocation) return;

  if (state.userMarker) {
    state.userMarker.remove();
  }

  state.userMarker = L.circleMarker([state.userLocation.lat, state.userLocation.lng], {
    radius: 10,
    color: '#ffffff',
    weight: 3,
    fillColor: '#d91b14',
    fillOpacity: 1,
  })
    .addTo(state.map)
    .bindPopup('You are here');
}

async function scanNearbyPlaces() {
  if (!state.userLocation) {
    requestUserLocation({ autoScan: true });
    return;
  }

  setStatus('Searching nearby food spots...', 'loading');
  el.apiStatus.textContent = 'Fetching live nearby results';

  const params = new URLSearchParams({
    lat: String(state.userLocation.lat),
    lng: String(state.userLocation.lng),
    radius: String(state.filters.radius),
    rankPreference: state.filters.sort,
    openNow: String(state.filters.openNow),
  });

  if (state.filters.mode === 'text') {
    params.set('mode', 'text');
    params.set('textQuery', state.filters.textQuery);
  } else {
    params.set('mode', 'nearby');
    params.set('includedType', state.filters.includedType);
  }

  if (state.filters.priceLevel) {
    params.set('priceLevel', state.filters.priceLevel);
  }

  try {
    const response = await fetch(buildApiUrl(`/api/nearby?${params.toString()}`));
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Could not load nearby places.');
    }

    state.places = (payload.places || []).map(place => ({
      ...place,
      distanceMeters: calculateDistanceMeters(
        state.userLocation.lat,
        state.userLocation.lng,
        place.location.latitude,
        place.location.longitude
      ),
    }));

    renderPlaces();
    renderMapMarkers();

    const resultsMessage = state.filters.mode === 'text'
      ? `Fresh ${state.filters.textQuery} picks loaded from Google Places.`
      : 'Fresh nearby picks loaded from Google Places.';

    setStatus(
      state.places.length
        ? resultsMessage
        : 'No places matched those filters. Try a wider radius or fewer filters.',
      state.places.length ? 'success' : 'warning'
    );
    el.apiStatus.textContent = `${state.places.length} live result${state.places.length === 1 ? '' : 's'}`;
  } catch (error) {
    setStatus(error.message, 'error');
    el.apiStatus.textContent = 'Search failed';
  }
}

function renderPlaces() {
  el.resultsList.innerHTML = '';
  el.resultCount.textContent = `${state.places.length} spot${state.places.length === 1 ? '' : 's'}`;
  el.resultsTitle.textContent = state.places.length
    ? `${state.filters.label} near you`
    : 'No matching places yet';

  if (!state.places.length) {
    el.resultsList.innerHTML =
      '<div class="status-banner" data-tone="warning">Try a bigger radius, a broader cuisine, or turn off "open now".</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  state.places.forEach(place => {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.placeId = place.id;
    card.tabIndex = 0;

    const isSaved = isFavorite(place.id);
    card.innerHTML = `
      <div class="result-card__top">
        <div>
          <h3>${escapeHtml(place.displayName?.text || 'Untitled place')}</h3>
          <div class="result-card__subtitle">${escapeHtml(
            place.primaryTypeDisplayName?.text || state.filters.label
          )}</div>
        </div>
        <div class="score-pill">${formatRating(place.rating, place.userRatingCount)}</div>
      </div>
      <div class="result-card__meta">
        <span class="distance-pill">${formatDistance(place.distanceMeters)}</span>
        <span>${formatPrice(place.priceLevel)}</span>
        <span>${place.currentOpeningHours?.openNow ? 'Open now' : 'Check hours'}</span>
      </div>
      <p class="result-card__address">${escapeHtml(place.formattedAddress || 'Address unavailable')}</p>
      <div class="saved-card__actions">
        <button
          class="favorite-toggle ${isSaved ? 'is-saved' : ''}"
          type="button"
          data-favorite-place-id="${escapeHtml(place.id)}"
        >
          ${isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    `;

    card.addEventListener('click', event => {
      if (event.target.closest('[data-favorite-place-id]')) return;
      selectPlace(place.id, true);
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectPlace(place.id, true);
      }
    });
    fragment.appendChild(card);
  });

  el.resultsList.appendChild(fragment);
  updateSelectedResultCard();
}

function renderMapMarkers() {
  state.placeMarkers.forEach(marker => marker.remove());
  state.placeMarkers = [];

  const bounds = [];

  state.places.forEach(place => {
    const { latitude, longitude } = place.location;
    const marker = L.marker([latitude, longitude])
      .addTo(state.map)
      .bindPopup(
        `<strong>${escapeHtml(place.displayName?.text || 'Untitled')}</strong><br>${escapeHtml(
          place.primaryTypeDisplayName?.text || 'Food spot'
        )}<br>${formatRating(place.rating, place.userRatingCount)}`
      );

    marker.on('click', () => selectPlace(place.id, false));
    state.placeMarkers.push(marker);
    bounds.push([latitude, longitude]);
  });

  if (state.userLocation) {
    bounds.push([state.userLocation.lat, state.userLocation.lng]);
  }

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [40, 40] });
  }
}

async function selectPlace(placeId, fromList) {
  state.selectedPlaceId = placeId;
  updateSelectedResultCard();
  applyPanelState('filters', false);

  const place = state.places.find(item => item.id === placeId) || state.favorites.find(item => item.id === placeId);
  if (!place) return;
  state.selectedPlace = place;

  if (fromList && place.location) {
    state.map.flyTo([place.location.latitude, place.location.longitude], 16, {
      duration: 0.8,
    });
  }

  el.detailsDrawer.classList.remove('is-empty');
  el.drawerTitle.textContent = place.displayName?.text || place.name || 'Selected place';
  el.drawerMeta.textContent = 'Loading more details and review snippets...';
  el.routeModeGroup.classList.remove('hidden');
  syncRouteModeButtons();
  el.routeSummary.classList.add('hidden');
  el.routeSummary.textContent = '';
  el.routeBtn.classList.remove('hidden');
  el.clearRouteBtn.classList.toggle('hidden', !state.routeLayer);
  el.reviewStack.innerHTML = '';

  try {
    const response = await fetch(buildApiUrl(`/api/place/${encodeURIComponent(placeId)}`));
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Could not load place details.');
    }

    const details = payload.place || payload;
    if (!details || !details.displayName) {
      throw new Error('Place details were returned in an unexpected format.');
    }
    el.drawerTitle.textContent =
      details.displayName?.text || place.displayName?.text || place.name || 'Selected place';
    state.selectedPlace = {
      ...place,
      ...details,
      location: details.location || place.location,
    };
    el.drawerMeta.textContent = [
      details.formattedAddress,
      formatRating(details.rating, details.userRatingCount),
      formatPrice(details.priceLevel),
      details.currentOpeningHours?.openNow ? 'Open now' : 'Hours may vary',
      details.websiteUri ? 'Website available' : '',
    ]
      .filter(Boolean)
      .join(' | ');

    if (details.googleMapsUri) {
      el.drawerMapsLink.href = details.googleMapsUri;
      el.drawerMapsLink.classList.remove('hidden');
    } else {
      el.drawerMapsLink.classList.add('hidden');
    }

    renderReviews(details.reviews || []);
  } catch (error) {
    el.drawerMeta.textContent = error.message;
    el.drawerMapsLink.classList.add('hidden');
  }
}

async function showRouteToSelectedPlace() {
  if (!state.userLocation) {
    setStatus('Pick your location first using the button or by clicking the map.', 'warning');
    return;
  }

  if (!state.selectedPlace?.location) {
    setStatus('Select a restaurant or hawker first before drawing a route.', 'warning');
    return;
  }

  const start = state.userLocation;
  const end = state.selectedPlace.location;

  setStatus('Calculating walking route...', 'loading');

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.longitude},${end.latitude}?overview=full&geometries=geojson`
    );
    const payload = await response.json();

    if (!response.ok || !payload.routes?.length) {
      throw new Error('Could not calculate a walking route right now.');
    }

    const route = payload.routes[0];
    clearRoute();

    state.routeLayer = L.geoJSON(route.geometry, {
      style: {
        color: '#169fdd',
        weight: 6,
        opacity: 0.85,
      },
    }).addTo(state.map);

    const bounds = state.routeLayer.getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [50, 50] });
    }

    state.routeData = {
      distance: route.distance,
    };
    renderRouteSummary(route.distance);
    el.clearRouteBtn.classList.remove('hidden');
    setStatus('Walking path drawn on the map.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function clearRoute() {
  if (state.routeLayer) {
    state.routeLayer.remove();
    state.routeLayer = null;
  }

  state.routeData = null;

  el.routeSummary.textContent = '';
  el.routeSummary.classList.add('hidden');
  el.clearRouteBtn.classList.add('hidden');
}

function clampValue(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function renderRouteSummary(distanceMeters) {
  const routeDistanceMeters = state.roundTrip ? distanceMeters * 2 : distanceMeters;
  const distanceKm = routeDistanceMeters / 1000;
  const profile = getRouteProfile(state.routeMode);
  const durationMin = distanceKm / profile.speedKmh * 60;
  const stepCount = Math.round(routeDistanceMeters / profile.stepLengthMeters);
  const calories = Math.round(distanceKm * getCaloriesPerKm(profile));

  el.routeSummary.innerHTML = `
    <strong>${profile.label}</strong>:
    <strong>${distanceKm.toFixed(2)} km</strong>,
    about <strong>${Math.round(durationMin)} min</strong>,
    around <strong>${stepCount.toLocaleString()} steps</strong>,
    about <strong>${calories} kcal</strong>.
  `;
  el.routeSummary.classList.remove('hidden');
  el.routeBtn.textContent = `Show ${profile.label.toLowerCase()} path`;
}

function getRouteProfile(mode) {
  if (mode === 'jog') {
    return {
      label: 'Jogging route',
      speedKmh: 8,
      stepLengthMeters: 0.78,
      caloriesPerKm: 62,
    };
  }

  return {
    label: 'Walking route',
    speedKmh: 5,
    stepLengthMeters: 0.7,
    caloriesPerKm: 45,
  };
}

function getCaloriesPerKm(profile) {
  const weightFactor = state.profile.weightKg / 70;
  const ageFactor = state.profile.age >= 40 ? 0.96 : 1;
  return profile.caloriesPerKm * weightFactor * ageFactor;
}

function syncRouteModeButtons() {
  el.walkModeBtn.classList.toggle('is-active', state.routeMode === 'walk');
  el.jogModeBtn.classList.toggle('is-active', state.routeMode === 'jog');
  el.roundTripBtn.classList.toggle('is-active', state.roundTrip);
  el.roundTripBtn.textContent = state.roundTrip ? 'Round trip' : 'One way';
}

function refreshNearbyIfReady() {
  if (state.userLocation) {
    scanNearbyPlaces();
  }
}

function renderReviews(reviews) {
  el.reviewStack.innerHTML = '';

  if (!reviews.length) {
    el.reviewStack.innerHTML =
      '<div class="review-card"><strong>No review snippets returned</strong><p>Google Places does not always return reviews for every place.</p></div>';
    return;
  }

  reviews.slice(0, 3).forEach(review => {
    const article = document.createElement('article');
    article.className = 'review-card';
    article.innerHTML = `
      <strong>${escapeHtml(review.authorAttribution?.displayName || 'Google reviewer')}</strong>
      <span>${formatReviewRating(review.rating)} | ${escapeHtml(
        review.relativePublishTimeDescription || 'Recent'
      )}</span>
      <p>${escapeHtml(review.text?.text || 'No review text returned.')}</p>
    `;
    el.reviewStack.appendChild(article);
  });
}

function renderSavedPlaces() {
  el.savedList.innerHTML = '';
  el.savedCount.textContent = `${state.favorites.length} saved`;

  if (!state.favorites.length) {
    el.savedList.innerHTML =
      '<div class="status-banner">Save a few nearby gems and they will stay here on this device.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  state.favorites.forEach(place => {
    const article = document.createElement('article');
    article.className = 'saved-card';
    article.innerHTML = `
      <div class="saved-card__top">
        <div>
          <h3>${escapeHtml(place.displayName?.text || place.name || 'Saved place')}</h3>
          <div class="result-card__subtitle">${escapeHtml(
            place.primaryTypeDisplayName?.text || place.label || 'Food spot'
          )}</div>
        </div>
        <div class="score-pill">${formatRating(place.rating, place.userRatingCount)}</div>
      </div>
      <p class="saved-card__address">${escapeHtml(place.formattedAddress || 'Address unavailable')}</p>
      <div class="saved-card__actions">
        <button type="button" data-jump-place-id="${escapeHtml(place.id)}">Show on map</button>
        <button type="button" data-remove-place-id="${escapeHtml(place.id)}">Remove</button>
      </div>
    `;
    fragment.appendChild(article);
  });

  el.savedList.appendChild(fragment);
}

function toggleFavoriteById(placeId) {
  const place = state.places.find(item => item.id === placeId);
  if (!place) return;

  if (isFavorite(placeId)) {
    removeFavorite(placeId);
    return;
  }

  state.favorites.unshift({
    id: place.id,
    displayName: place.displayName,
    primaryTypeDisplayName: place.primaryTypeDisplayName,
    formattedAddress: place.formattedAddress,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    location: place.location,
    googleMapsUri: place.googleMapsUri,
    label: state.filters.label,
  });

  persistFavorites();
  renderSavedPlaces();
  renderPlaces();
  setStatus('Saved to your favorites on this device.', 'success');
}

function removeFavorite(placeId) {
  state.favorites = state.favorites.filter(place => place.id !== placeId);
  persistFavorites();
  renderSavedPlaces();
  renderPlaces();
  setStatus('Removed from your saved spots.', 'success');
}

function isFavorite(placeId) {
  return state.favorites.some(place => place.id === placeId);
}

function updateSelectedResultCard() {
  document.querySelectorAll('.result-card').forEach(card => {
    card.classList.toggle('is-selected', card.dataset.placeId === state.selectedPlaceId);
  });
}

function resetFilters() {
  state.filters = { ...defaultFilter };

  el.radiusSelect.value = String(defaultFilter.radius);
  el.sortSelect.value = defaultFilter.sort;
  el.openNowCheckbox.checked = false;
  syncActiveChip(
    el.priceFilters,
    el.priceFilters.querySelector('[data-price=""]'),
    '[data-price]'
  );
  syncActiveChip(
    el.cuisineFilters,
    el.cuisineFilters.querySelector('[data-type="restaurant"]'),
    '[data-mode]'
  );

  setStatus('Filters reset. Run another scan when you are ready.', 'success');
}

function syncActiveChip(container, activeButton, selector) {
  container.querySelectorAll(selector).forEach(button => {
    button.classList.toggle('is-active', button === activeButton);
  });
}

function setStatus(message, tone) {
  el.statusBanner.textContent = message;
  el.statusBanner.dataset.tone = tone;
}

function togglePanel(panelName) {
  const card = document.querySelector(`[data-panel="${panelName}"]`);
  if (!card) return;
  const willOpen = !card.classList.contains('is-open');

  if (willOpen) {
    ['filters', 'results', 'saved'].forEach(name => {
      applyPanelState(name, name === panelName);
    });
    return;
  }

  applyPanelState(panelName, false);
}

function applyPanelState(panelName, isOpen) {
  const card = document.querySelector(`[data-panel="${panelName}"]`);
  const toggle = document.getElementById(`${panelName}Toggle`);
  if (!card || !toggle) return;

  card.classList.toggle('is-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return 'Distance unavailable';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

function formatRating(rating, count) {
  if (!rating) return 'No rating yet';
  return `${rating.toFixed(1)}*${count ? ` (${count})` : ''}`;
}

function formatReviewRating(rating) {
  if (!rating) return 'Unrated';
  return `${rating.toFixed(1)}* review`;
}

function formatPrice(priceLevel) {
  const map = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$ Budget',
    PRICE_LEVEL_MODERATE: '$$ Mid-range',
    PRICE_LEVEL_EXPENSIVE: '$$$ Treat',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$ Splash out',
  };

  return map[priceLevel] || 'Price unknown';
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function buildApiUrl(pathname) {
  return `${apiBaseUrl}${pathname}`;
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(favoritesStorageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function persistFavorites() {
  localStorage.setItem(favoritesStorageKey, JSON.stringify(state.favorites));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
