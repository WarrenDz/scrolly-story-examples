import Extent from "https://js.arcgis.com/4.26/@arcgis/core/geometry/Extent.js";
// Set DEBUG to true to enable debug logging
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
let mapChoreography;

// Define the map and bookmarks components
const mapElement = document.querySelector("arcgis-map");
const timeSlider = document.querySelector("arcgis-time-slider");

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
  const map = view.map;

  // Access the layers within the map
  const mapLayers = map.layers;

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
      case "viewpoint":
        if (view && payload.viewpoint) {
          view.goTo(payload.viewpoint, { animate: true, duration: 1000 });
        }
        break;
      default:
        // Handle unknown types or legacy camera payloads
        log("Unknown payload type:", payload.type);
        break;
    }
  });

  //Hash change listener
  window.addEventListener("hashchange", function () {
    // Code to execute when the hash changes
    log("Hash changed to: " + window.location.hash);
    processHash();
  });

  // Function to process the current hash and update the map accordingly
  // This function handles map choreography when the story is viewed outside of the embedded iframe context
  function processHash() {
    const hashIndex = parseInt(window.location.hash.substring(1), 10);

    if (isNaN(hashIndex) || !mapChoreography[hashIndex]) {
      log("No valid hash index found.");
      return;
    }

    const mapChoreo = mapChoreography[hashIndex];


    // Layer visibility
    // Function to toggle the visibility of a list of layer names
    // Takes a list of layer names and a boolean to set visibility on or off based on comparison against layer name in the map
    function toggleLayerVisibility(layerNames, visibility) {
      if (mapChoreo.layerVisibility) {
        if (layerNames && layerNames.length > 0) {
          mapLayers.forEach((mapLayer) => {
            if (layerNames.includes(mapLayer.title)) {
              mapLayer.visible = visibility; // Set visibility based on the argument
              log(
                visibility
                  ? "(+) " + mapLayer.title + " is now visible."
                  : "(-) " + mapLayer.title + " is now hidden."
              );
            }
          });
        }
      }
    }
    const layersOn = mapChoreo.layerVisibility.layersOn;
    const layersOff = mapChoreo.layerVisibility.layersOff;

    toggleLayerVisibility(layersOn, true); // Turn on specified layers
    toggleLayerVisibility(layersOff, false); // Turn off specified layers

  
    // Track renderer
    // Apply track renderer if defined in the choreography
    if (mapChoreo.trackRenderer) {
      log("Applying track renderer:", mapChoreo.trackRenderer.trackLayerName);
      const trackRenderer = mapChoreo.trackRenderer;
      let trackLayer = mapLayers.find((layer) => layer.title === trackRenderer.trackLayerName);
      if (trackLayer) {
        // these are an attempt to do a hard reset on the renderer when we switch hashes
        map.remove(trackLayer);
        trackLayer = trackLayer.clone();
        map.add(trackLayer);
        //
        log("Found track layer named:", trackLayer.title);
        const trackStartField = trackLayer.timeInfo.startField;
        trackLayer.visible = true; // Make the layer visible
        trackLayer.timeInfo = {
          startField: trackStartField,
          trackIdField: trackLayerField,
          interval: {
            unit: choreographyMapping[hash].timeSliderUnit,
            value: choreographyMapping[hash].timeSliderStep
          }
        };
        // Apply renderer from choreography data
        trackLayer.trackInfo = trackRenderer.trackInfo
        };

    // Camera viewpoint
    // if (mapChoreo.camera) {
    //   /// Do stuff here
    // }

    // Viewpoint/extent
    if (mapChoreo.viewpoint) {
      const viewpoint = mapChoreo.viewpoint;
      log("Setting viewpoint:", viewpoint);
      view.goTo(viewpoint, { animate: true, duration: 2500 });
    }

    // // Time slider
    // if (mapChoreo.timeRange && timeSlider) {
    //   timeSlider.setRange(mapChoreo.timeRange);
    // }
    
  }
}
  // Initial hash processing
  processHash();
});


