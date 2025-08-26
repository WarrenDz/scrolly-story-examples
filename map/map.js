import Extent from "https://js.arcgis.com/4.26/@arcgis/core/geometry/Extent.js";
// Set DEBUG to true to enable debug logging
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Define the map and bookmarks components
const mapElement = document.querySelector("arcgis-map");
const timeSlider = document.querySelector("arcgis-time-slider");
const resetButton = document.querySelector("#reset-button");

// Hardcoding this for now
let mapChoreography = [
  {
    viewpoint: {
      rotation: 0,
      scale: 1155581.108577,
      targetGeometry: {
        spatialReference: {
          latestWkid: 3857,
          wkid: 102100,
        },
        xmin: -9480987.971538901,
        ymin: 4993703.648371119,
        xmax: -9043156.673521623,
        ymax: 5272545.927555308,
      },
    },
  },
  {
    viewpoint: {
      rotation: 0,
      scale: 18489297.737236,
      targetGeometry: {
        spatialReference: {
          latestWkid: 3857,
          wkid: 102100,
        },
        xmin: -12315034.114639107,
        ymin: 940916.8624067632,
        xmax: -5309733.346361135,
        ymax: 5402393.329354744,
      },
    },
  },
  {
    viewpoint: {
      rotation: 0,
      scale: 1155581.108577,
      targetGeometry: {
        spatialReference: {
          latestWkid: 3857,
          wkid: 102100,
        },
        xmin: -8195493.916410449,
        ymin: 1037891.5647293258,
        xmax: -7757662.618393171,
        ymax: 1316733.8439135144,
      },
    },
  },
];

// Load the map choreography data from a JSON file
// This file contains all the configurations for each slide, including camera positions, time slider settings, and layer visibility.
async function loadMapChoreography() {
  const response = await fetch("../public/mapChoreography.json");
  return await response.json();
}

// Wait for a change in readiness from the map element
mapElement.addEventListener("arcgisViewReadyChange", async (event) => {
  // When the map is ready...
  if (!event.target.ready) return;

  // Access the MapView from the arcgis-map component
  const view = mapElement.view;

  // Disable map navigation
  if (DEBUG) {
    view.on("mouse-wheel", (event) => {
      event.stopPropagation();
    });
    view.on("drag", (event) => {
      event.stopPropagation();
    });
  }

  // Load the map choreography data
  mapChoreography = await loadMapChoreography();

  // Listener for messages with payloads for map updates
  // This allows the iframe to communicate with the map and update its state based on the current slide.
  // This controls the map when the story is viewed inside the embedded iframe context.
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
          log("extent payload received:", payload.extent);
          view.goTo(payload.extent, { animate: true, duration: 1000 });
        }
        break;
      case "viewpoint":
        if (view && payload.viewpoint) {
          view.goTo(payload.viewpoint, { animate: true, duration: 1000 });
        }
        break;
      case "bookmark":
        // Implement bookmark logic here
        if (choreographyMapping[hash]) {
          // Set the initial map extent by the bookmarkStart
          const bookmarks = view.map.bookmarks; // Get the bookmarks array from the WebMap
          const targetBookmark = bookmarks.find((b) => b.name === bookmarkName);
          // Find the bookmark by name
          // If the bookmark exists, navigate to it
          if (targetBookmark) {
            adjustMapPadding(view); // Ensure padding is set before navigating
            const bookmarkTarget = targetBookmark.viewpoint;
            view.goTo(bookmarkTarget, { duration: 2000 });
          } else {
            console.error(`Bookmark "${bookmarkName}" not found!`);
          }
        }
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

  //Hash change listener
  window.addEventListener("hashchange", function () {
    // Code to execute when the hash changes
    log("Hash changed to: " + window.location.hash);
    processHash();
  });

  // Initial hash processing
  processHash();

  // Function to process the current hash and update the map accordingly
  // This function handles map choreography when the story is viewed outside of the embedded iframe context
  function processHash() {
    const hashIndex = parseInt(window.location.hash.substring(1), 10);

    if (isNaN(hashIndex) || !mapChoreography[hashIndex]) {
      log("No valid hash index found.");
      return;
    }

    const mapChoreo = mapChoreography[hashIndex];

    // // Camera viewpoint
    // if (mapChoreo.camera) {
    //   /// Do stuff here
    // }

    // // Viewpoint/extent
    if (mapChoreo.viewpoint) {
      const viewpoint = mapChoreo.viewpoint;
      log("Setting viewpoint:", viewpoint);
      view.goTo(viewpoint, { animate: true, duration: 2500 });
    }

    // // Time slider
    // if (mapChoreo.timeRange && timeSlider) {
    //   timeSlider.setRange(mapChoreo.timeRange);
    // }

    // // Bookmarks
    // if (mapChoreo.bookmark) {
    //   // Example: view.goToBookmark(mapChoreo.bookmark);
    //   // Implement your bookmark logic here
    // }

    // // Layers
    // if (mapChoreo.layers) {
    //   // Example: updateLayerVisibility(mapChoreo.layers);
    //   // Implement your layer logic here
    // }
  }
});
