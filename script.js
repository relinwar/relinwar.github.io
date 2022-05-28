'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

var carIcon = L.Icon.extend({
  options: {
    shadowUrl: null,
    iconSize: [50, 42],
    iconAnchor: [25, 45],
    popupAnchor: [0, -45],
  },
});

var meIcon = L.Icon.extend({
  options: {
    shadowUrl: null,
    iconSize: [48, 50],
    iconAnchor: [25, 45],
    popupAnchor: [0, -45],
  },
});

var cpMarker = new carIcon({ iconUrl: 'carMarker.png' }),
   meMarker = new meIcon({ iconUrl: 'MeMarker.png' });
  // orangeIcon = new LeafIcon({ iconUrl: 'leaf-orange.png' });

if (navigator.geolocation)
  navigator.geolocation.getCurrentPosition(
    function (position) {
      const { latitude } = position.coords;
      const { longitude } = position.coords;

      const coords = [latitude, longitude];
      const map = L.map('map').setView(coords, 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      //L.marker(coords).addTo(map).bindPopup('I am here!').openPopup();
      L.marker(coords, {icon: meMarker}).addTo(map).bindPopup("JayChou here!");
      // L.Routing.control({
      //   waypoints: [L.latLng(57.74, 11.94), L.latLng(57.6792, 11.949)],
      // }).addTo(map);

      // var fs = require('fs');
      // var array = fs.readFileSync('file.txt').toString().split("\n");
      // for(i in array) {
      //     console.log(array[i]);
      //     L.marker([array[i]], {icon: cpMarker}).addTo(map);
      // }

      L.marker([1.3970461065256796, 103.88168938051157], {icon: cpMarker}).addTo(map);
      L.marker([1.392193366944645, 103.87750563306257], {icon: cpMarker}).addTo(map);
      L.marker([1.3964673870336781, 103.89513734750588], {icon: cpMarker}).addTo(map);
      L.marker([1.3741738531294714, 103.96142867260357], {icon: cpMarker}).addTo(map);
      L.marker([1.3970000352966223, 103.87823144695625], {icon: cpMarker}).addTo(map);
      L.marker([1.3941058330512957, 103.87524871008509], {icon: cpMarker}).addTo(map);
      L.marker([1.3903327003033288, 103.88000552219727], {icon: cpMarker}).addTo(map);
      L.marker([1.3963689354684246, 103.8897177933891], {icon: cpMarker}).addTo(map);
      L.marker([1.390715256015856, 103.89048180251991], {icon: cpMarker}).addTo(map);
      L.marker([1.389802780249019, 103.88647505255724], {icon: cpMarker}).addTo(map);
      L.marker([1.3939974071215235, 103.89929034909169], {icon: cpMarker}).addTo(map);
      L.marker([1.4013202281871957, 103.89130877216515], {icon: cpMarker}).addTo(map);
      L.marker([1.3868063618413917, 103.89612466495701], {icon: cpMarker}).addTo(map);
      L.marker([1.4055327317071737, 103.89703003419655], {icon: cpMarker}).addTo(map);
      L.marker([1.4031109074804702, 103.90195411708976], {icon: cpMarker}).addTo(map);
      L.marker([1.3570809809207025, 103.95918131792953], {icon: cpMarker}).addTo(map);
      L.marker([1.3532712337800754, 103.95610995547024], {icon: cpMarker}).addTo(map);
      L.marker([1.3532378729108936, 103.95228076038806], {icon: cpMarker}).addTo(map);
      L.marker([1.3581126489427735, 103.98986176311318], {icon: cpMarker}).addTo(map);
      L.marker([1.2850805378451813, 103.83485203692152], {icon: cpMarker}).addTo(map);
      L.marker([1.2899066928322542, 103.82821919649989], {icon: cpMarker}).addTo(map);
      L.marker([1.2753868010394493, 103.84145863472764], {icon: cpMarker}).addTo(map);
      L.marker([1.2915174534197134, 103.84981154080029], {icon: cpMarker}).addTo(map);
      L.marker([1.2766722034677367, 103.81090431266485], {icon: cpMarker}).addTo(map);
      L.marker([1.2738043313552085, 103.8258039559094], {icon: cpMarker}).addTo(map);
      L.marker([1.2805941328819004, 103.81143486879564], {icon: cpMarker}).addTo(map);
      L.marker([1.2863373185454232, 103.80999687215237], {icon: cpMarker}).addTo(map);
      L.marker([1.3780283380194862, 103.87773663098721], {icon: cpMarker}).addTo(map);
      L.marker([1.3742773796155305, 103.87914967953796], {icon: cpMarker}).addTo(map);
      L.marker([1.3716715195132176, 103.87533737966228], {icon: cpMarker}).addTo(map);
      L.marker([1.3738534508816789, 103.85605719533379], {icon: cpMarker}).addTo(map);
      L.marker([1.3822264508865618, 103.84134481438716], {icon: cpMarker}).addTo(map);
      L.marker([1.379271227528678, 103.83621918363957], {icon: cpMarker}).addTo(map);

      //Click Add marker
      // map.on('click', function (mapEvent) {
      //   console.log(mapEvent);
      //   const { lat, lng } = mapEvent.latlng;

      //   L.marker([lat, lng])
      //     .addTo(map)
      //     .bindPopup(
      //       L.popup({
      //         maxWidth: 250,
      //         minWidth: 100,
      //         autoClose: false,
      //         closeOnClick: false,
      //         className: 'running-popup',
      //       })
      //     )
      //     .setPopupContent('Workout')
      //     .openPopup();
      // });

      //   // The location of Uluru
      //   const loc = { lat: latitude, lng: longitude };
      //   // The map, centered at Uluru
      //   const mapp = new google.maps.Map(document.getElementById('map'), {
      //     zoom: 16,
      //     center: loc,
      //   });
      //   // The marker, positioned at Uluru
      //   const marker = new google.maps.Marker({
      //     position: loc,
      //     map: map,
      //   });
    },
    function () {
      alert('Could not get your position, please allow location access.');
    }
  );
