// Imports
const Viewpoint = await $arcgis.import("@arcgis/core/Viewpoint.js");

// Set DEBUG to true to enable debug logging
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
let mapChoreography;
let isEmbedded = false; // Flag to indicate if the map is viewed in an embedded context

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

  // If not debug disable mouse wheel and drag events to prevent zooming and panning
  if (!DEBUG) {
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

    // Check for isEmbedded flag
    if (payload.isEmbedded) {
      log("This map is being viewed in an embedded storymap.");
      // You can set a variable or trigger embedded-specific logic here
      isEmbedded = true;
    }

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
        if (timeSlider && payload.timepoint) {
          log("Setting timeSlider to:", payload.timepoint);
          timeSlider.timeExtent = {
            start: null,
            end: new Date(payload.timepoint),
          };
          timeSlider.stop();
        }
        break;
      case "viewpoint":
        if (view && payload.viewpoint) {
          const targetViewpoint = Viewpoint.fromJSON(payload.viewpoint);
          log("Setting viewpoint:", targetViewpoint);
          view.goTo(targetViewpoint, {
              animate: true,
              duration: 1000,
            })
            .catch((error) => {
              log("Error setting viewpoint:", error);
            });
        }
        break;
      default:
        // Handle unknown types or legacy camera payloads
        log("Unknown payload type:", payload.type);
        break;
    }
  });

  //Hash change listener
  // Will trigger the map to update based on the current hash in the URL
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
    // This requires trackRenderer and timeSlider to be defined in the choreography data
    async function applyTrackRenderer() {
      if (mapChoreo.trackRenderer && mapChoreo.timeSlider) {
        // Assign readable variables from choreography data for clarity
        const trackRenderer = mapChoreo.trackRenderer;
        const timeSlider = mapChoreo.timeSlider;
        const trackLayerField = trackRenderer.trackFieldName;
        const trackTimeSliderUnit = timeSlider.timeSliderUnit;
        const trackTimeSliderStep = timeSlider.timeSliderStep;
        let trackLayer = mapLayers.find(
          (layer) => layer.title === trackRenderer.trackLayerName
        );
        if (trackLayer) {
          // these are an attempt to do a hard reset on the renderer when we switch hashes
          map.remove(trackLayer);
          trackLayer = trackLayer.clone();
          map.add(trackLayer);
          //
          log(
            "Applying track renderer:",
            mapChoreo.trackRenderer.trackLayerName
          );
          await trackLayer.when(); // Wait for the layer to load
          const trackStartField = trackLayer.timeInfo.startField;
          trackLayer.visible = true; // Make the layer visible
          trackLayer.timeInfo = {
            startField: trackStartField,
            trackIdField: trackLayerField,
            interval: {
              unit: trackTimeSliderUnit,
              value: trackTimeSliderStep,
            },
          };
          // Apply renderer from choreography data
          trackLayer.trackInfo = trackRenderer.trackInfo;
        }
      } else if (!mapChoreo.timeSlider) {
        log("No timeSlider configuration found in choreography.");
      }
    }
    applyTrackRenderer();

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

    // Time slider
    function configureTimeSlider() {
      // Requires timeSlider component and timeSlider configuration in choreography
      if (
        timeSlider &&
        mapChoreo.timeSlider &&
        mapChoreo.timeSlider.timeSliderStart &&
        mapChoreo.timeSlider.timeSliderEnd
      ) {
        const timeStart = mapChoreo.timeSlider.timeSliderStart;
        const timeEnd = mapChoreo.timeSlider.timeSliderEnd;
        const timeUnit = mapChoreo.timeSlider.timeSliderUnit;
        const timeStep = mapChoreo.timeSlider.timeSliderStep;
        // Configure the slider full extent with the start and end times from choreography
        const startFrame = new Date(timeStart);
        const endFrame = new Date(timeEnd);
        timeSlider.fullTimeExtent = { start: startFrame, end: endFrame };
        log("Configuring time slider:", {
          start: startFrame,
          end: endFrame,
          timeUnit: timeUnit,
          timeStep: timeStep,
        });
        timeSlider.timeExtent = { start: null, end: startFrame };
        // Set the time slider interval based on choreography
        timeSlider.stops = {
          interval: {
            value: timeStep,
            unit: timeUnit,
          },
        };

        // Start the time slider if not already playing and if outside script embed story
        // *Note: this doesn't seem to work and the timeSlider always starts playing
        if (timeSlider.state === "ready" && isEmbedded === false) {
          timeSlider.play();
        }
      } else if (!timeSlider) {
        log("No timeSlider component found.");
      } else {
        log("No timeSlider configuration found in choreography.");
      }
    }
    configureTimeSlider();
  }
  // Initial hash processing
  processHash();
});
