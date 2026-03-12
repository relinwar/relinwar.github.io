# Hawker Hunt Singapore

Find nearby food spots in Singapore by cuisine, radius, budget, and Google ratings.

## What this version does

- Uses browser geolocation to center the experience around the user
- Searches nearby food spots with Google Places API
- Filters by cuisine, price, distance, open-now state, and Singapore-specific dish tags
- Shows ratings, review counts, address, and review snippets
- Lets users save favorite spots locally on their own device
- Keeps the Google API key on the server instead of exposing it in browser code

## Setup

1. Copy `.env.example` to `.env`
2. Add your Google Places API key:

```env
GOOGLE_MAPS_API_KEY=your_key_here
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,https://relinwar.github.io
```

3. For local frontend-to-backend calls, keep `site-config.js` as:

```js
window.HAWKER_HUNT_CONFIG = {
  API_BASE_URL: '',
};
```

4. Start the app:

```bash
npm start
```

5. Open `http://localhost:3000`

## Google APIs to enable

- Places API

## Deployment

### GitHub Pages frontend

- The workflow in `.github/workflows/deploy-pages.yml` publishes the static site from `main`
- Before pushing, update `site-config.js` so `API_BASE_URL` points at your deployed backend
- In the repo settings, enable GitHub Pages and choose GitHub Actions as the source if prompted

### Render backend

- `render.yaml` sets up a small Node web service
- Create a new Render Blueprint or web service from this repo
- Set `GOOGLE_MAPS_API_KEY`
- Set `ALLOWED_ORIGINS` to your GitHub Pages URL, for example `https://relinwar.github.io`
- After Render gives you a service URL, put it into `site-config.js`

## Good next upgrades

- request caching
- user accounts with synced saved lists
- custom ranking for hawker spots vs chain restaurants
- your own ranking layer on top of Google data
