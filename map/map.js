// Set DEBUG to true to enable debug logging
const DEBUG = false;

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Define the map and bookmarks components
const mapElement = document.querySelector("arcgis-map");
const timeSlider = document.querySelector("arcgis-time-slider");
const resetButton = document.querySelector("#reset-button");

let mapChoreography = [];

async function initialize() {
  mapChoreography = await loadMapChoreography();
  setupMessageListener();
  setupHashListener();
  processHash();
}

async function loadMapChoreography() {
  const response = await fetch("src/mapChoreography.json");
  return await response.json();
}

// Wait for a change in readiness from the map element
mapElement.addEventListener("arcgisViewReadyChange", (event) => {
  // When the map is ready...
  if (event.target.ready) {
    // Assign a previous hash variable to store the last hash
    let previousHash = null;
    let hash = window.location.hash || "#slide1"; // if no has is present use #slide1

    // Access the MapView from the arcgis-map component
    const view = mapElement.view;

    // // Disable map navigation
    // view.on("mouse-wheel", (event) => {
    //   event.stopPropagation();
    // });
    // view.on("drag", (event) => {
    //   event.stopPropagation();
    // });
  }
});

function setupMessageListener() {
  window.addEventListener("message", (event) => {
    if (event.data.source !== "storymap-controller") return;

    const payload = event.data.payload;

    // Use a 'type' property to distinguish what to interpolate
    switch (payload.type) {
      case "camera":
        view.goTo(
          {
            position: {
              x: payload.x,
              y: payload.y,
              z: payload.z,
            },
            tilt: payload.tilt,
            heading: payload.heading,
            fov: payload.fov || 100,
          },
          {
            animate: true,
            duration: 250,
          }
        );
        break;
      case "timeSlider":
        if (timeSlider) {
          timeSlider.setPosition(payload.slide, payload.progress);
        }
        break;
      case "extent":
        if (view && payload.extent) {
          view.goTo(payload.extent, { animate: true, duration: 250 });
        }
        break;
      case "bookmark":
        // Implement bookmark logic here
        break;
      default:
        // Handle unknown types or legacy camera payloads
        if (payload.x && payload.y && payload.z) {
          view.goTo(
            {
              position: {
                x: payload.x,
                y: payload.y,
                z: payload.z,
              },
              tilt: payload.tilt,
              heading: payload.heading,
              fov: payload.fov || 100,
            },
            {
              animate: true,
              duration: 250,
            }
          );
        }
        break;
    }
  });
}

function setupHashListener() {
  window.addEventListener("hashchange", function () {
    // Code to execute when the hash changes
    console.log("Hash changed to: " + window.location.hash);
    processHash();
  });
}

function processHash() {
  const hashIndex = parseInt(window.location.hash.substring(1), 10);

  if (isNaN(hashIndex) || !routeSegments[hashIndex]) {
    console.log("No valid hash index found.");
    return;
  }

  const camera = routeSegments[hashIndex].result;
  view.goTo({
    position: { x: camera.x, y: camera.y, z: camera.z },
    tilt: camera.tilt,
    heading: camera.heading,
    fov: camera.fov || 100,
  });
}

initialize();

