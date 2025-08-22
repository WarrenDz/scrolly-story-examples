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

// Define a the mapping between slides and time ranges
const choreographyMapping = {
  "#slide1": {
    trackLayer: "Osprey Points",
    trackField: "tag_local_identifier",
    trackLabelField: "event_id",
    trackLabelIds: ["1828224806", "1999613313", "2012515059", "2017197455"],
    mapBookmark: "Osprey",
    mapLayersOn: [],
    mapLayersOff: ["Deer Grazing", "Deer Points", "Deer Highway Annotation", "Whale Points", "Whale Traffic Corridor", "Global Ship Density", "Deer Supporting Layers", "Deer Lines Feature", "Whale Lines Feature"],
    mapTimeSyncedLayers: [{
      layer: "Osprey Audubon Island",
      visibleFrom: "2016-08-22T00:00:00Z"
    },
    {
      layer: "Osprey Caesar Creek",
      visibleFrom: "2016-09-01T00:00:00Z"
    },
    {
      layer: "Osprey Waccasassa Bay",
      visibleFrom: "2016-10-10T00:00:00Z"
    },
    { layer: "Osprey Maracaibo",
      visibleFrom: "2016-10-23T00:00:00Z"
    }],
    timeSliderStart: "2016-08-15T00:00:00Z",
    timeSliderEnd: "2016-11-21T00:00:00Z",
    timeSliderUnit: "hours",
    timeSliderStep: 6
  }
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

    // Disable map navigation
    view.on("mouse-wheel", (event) => {
      event.stopPropagation();
    });
    view.on("drag", (event) => {
      event.stopPropagation();
    });

  function adjustMapPadding(view) {
    // Define your desktop breakpoint (e.g., 1024px)
    const desktopBreakpoint = 1024;
    if (window.innerWidth >= desktopBreakpoint) {
      // Example: reserve 350px on the right for UI
      view.padding = {
        left: 500,
        right: 0,
        top: 0,
        bottom: 0
      };
    } else {
      // No padding for mobile/tablet
      view.padding = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      };
    }
  }

    // Call this after the MapView is available
  mapElement.addEventListener("arcgisViewReadyChange", (event) => {
    if (event.target.ready) {
      const view = event.target.view;
      adjustMapPadding(view);

      // Optionally, update padding on window resize
      window.addEventListener("resize", () => adjustMapPadding(view));
    }
  });
    // Access the WebMap instance from the view
    const map = view.map;

    // MAIN CHOREOGRAPHY FUNCTION
    async function updateMapChoreography() {
      // Get the current hash of the browser window
      // Use this to pull map choreography info
      let hash = window.location.hash || "#slide1"; // if no has is present use #slide1
      log("Current hash:", hash);

      // Access the layers within the map
      const layers = map.layers;

      // Configure the track layer
      // Find the name of the desired track layer in the map layers
      let trackLayer = layers.find((layer) => layer.title === choreographyMapping[hash].trackLayer);

      // If found configure the track renderer
      async function applyTrackRender(trackLayerName, trackLayerField, trackLabelField, trackLabelIds) {
        if (trackLayer) {
          // these are an attempt to do a hard reset on the renderer when we switch hashes
          map.remove(trackLayer);
          trackLayer = trackLayer.clone();
          map.add(trackLayer);
          //
          log("Found track layer named:", trackLayer.title);
          await trackLayer.when(); // Wait for the layer to load
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
          let whereClause = trackLabelField + ` IN (${trackLabelIds.map(id => `'${id}'`).join(",")})`;
          trackLayer.trackInfo = {
            enabled: true,
            timeField: "startTimeField",
            latestObservations: {
              visible: true,
              renderer: {
                type: "simple",
                symbol: {
                  type: "simple-marker",
                  style: "circle",
                  color: "White",
                  size: 10,
                  outline: {
                    color: "black",
                    width: 2
                  }
                }
              }
            },
            previousObservations: {
              enabled: true,
              visible: true,
              labelsVisible: true,
              labelingInfo: [
                {
                  symbol: {
                    type: "text",
                    color: "white",
                    haloColor: "black",
                    haloSize: 1.5,
                    font: {
                      family: "Noto Sans",
                      size: 8,
                      weight: "bold"
                    }
                  },
                  labelPlacement: "above-right",
                  labelExpressionInfo: {
                    expression: "Text($feature." + trackStartField + ", 'MMMM D, Y')"
                  },
                  where: whereClause
                }
              ],
              renderer: {
                type: "simple",
                symbol: {
                  type: "simple-marker",
                  style: "circle",
                  color: "white",
                  size: 2.5
                }
              }
            },
            trackLines: {
              visible: true,
              enabled: true,
              renderer: {
                type: "simple",
                symbol: {
                  type: "simple-line",
                  color: "black",
                  width: 2.5
                }
              }
            }
          };
        }
      }
      // Function to update the map bookmark
      function updateMapBookmark(bookmarkName) {
        if (choreographyMapping[hash]) {
          // Set the initial map extent by the bookmarkStart
          const bookmarks = view.map.bookmarks; // Get the bookmarks array from the WebMap
          const targetBookmark = bookmarks.find(b => b.name === bookmarkName);
          // Find the bookmark by name
          // If the bookmark exists, navigate to it
          if (targetBookmark) {
            adjustMapPadding(view); // Ensure padding is set before navigating
            const bookmarkTarget = targetBookmark.viewpoint;
            bookmarkTarget.scale = bookmarkTarget.scale * 1.1;
            view.goTo(bookmarkTarget, { duration: 6000 });
          } else {
            console.error(`Bookmark "${bookmarkName}" not found!`);
          } 
        }
      }
      // Function to toggle the visibility of a list of layer names
      function setLayerVisibility(layers, layerNames, visibility) {
        if (layerNames && layerNames.length > 0) {
          layers.forEach((layer) => {
            if (layerNames.includes(layer.title)) {
              layer.visible = visibility; // Set visibility based on the argument
              log(
                visibility
                  ? "(+) " + layer.title + " is now visible."
                  : "(-) " + layer.title + " is now hidden."
              );
            }
          });
        }
      }
      // This function manages the visibility of time-synced layers
      // It only turns these layers on in the map if the current time is greater than the visibleFrom date
      function manageTimeSyncedLayers(currentTimeSynced, previousTimeSynced, currentTime, layers) {
        // Create a map of layers for efficient lookups
        let layerMap = new Map(layers.map((layer) => [layer.title, layer]));
      
        // Function to set the visibility of layers based on time-synced data
        function updateLayerVisibility(timeSynced) {
          if (timeSynced && timeSynced.length > 0) {
            timeSynced.forEach((sync) => {
              const layer = layerMap.get(sync.layer);
              if (layer) {
                const visibleFrom = new Date(sync.visibleFrom);
                layer.visible = currentTime >= visibleFrom;
                log(
                  layer.visible
                    ? "(+) " + layer.title + " is now visible (current time-synced layer)."
                    : "(-) " + layer.title + " remains hidden (current time-synced layer)."
                );
              }
            });
          }
        }
      
      // Turn off previous layers
      setLayerVisibility(layerMap, previousTimeSynced.map(sync => sync.layer), false);
      
        // Update visibility for current layers
        updateLayerVisibility(currentTimeSynced);
      }

      // Function to define and start the timeSlider component of the animation
      function updateTimeSlider(timeStart, timeEnd, timeUnit, timeStep, timeSynced, layers, previousTimeSynced) {
        // Configure the time sliders full extent with the start and end time from choreographyMapping
        const startFrame = new Date(timeStart);
        const endFrame = new Date(timeEnd);
        timeSlider.fullTimeExtent = {start: startFrame, end: endFrame};
        timeSlider.timeExtent = {start: null, end: startFrame}
        // Set the timeSlider stops
        timeSlider.stops = {
          interval: {
            unit: timeUnit,
            value: timeStep
          }
        };
        // Listen for time extent changes
        if (timeSynced && timeSynced.length > 0) {
          timeSlider.addEventListener("arcgisPropertyChange", async (event) => {
            let currentTime = timeSlider.timeExtent.end;
            // Update time-synced layers
            manageTimeSyncedLayers(timeSynced, previousTimeSynced, currentTime, layers);
          });
        }
        
        // Start a TimeSlider animation if not already playing
        if (timeSlider.state === "ready") {
          timeSlider.play();
        }
      }
      // Call functions
      try {
        await applyTrackRender(
          choreographyMapping[hash].trackLayer,
          choreographyMapping[hash].trackField,
          choreographyMapping[hash].trackLabelField,
          choreographyMapping[hash].trackLabelIds
        ); // Wait for the track renderer to be applied

        updateMapBookmark(choreographyMapping[hash].mapBookmark);

        updateTimeSlider(
          choreographyMapping[hash].timeSliderStart,
          choreographyMapping[hash].timeSliderEnd,
          choreographyMapping[hash].timeSliderUnit,
          choreographyMapping[hash].timeSliderStep,
          choreographyMapping[hash].mapTimeSyncedLayers,
          layers,
          choreographyMapping[previousHash]?.mapTimeSyncedLayers || []
        );
        // Turn off layer visibility
        if (choreographyMapping[hash].mapLayersOn.length > 0) {
          setLayerVisibility(layers, choreographyMapping[hash].mapLayersOn, true);
        }
        // Turn on layer visibility
        if (choreographyMapping[hash].mapLayersOff.length > 0) {
          setLayerVisibility(layers, choreographyMapping[hash].mapLayersOff, false);
        }

        // Update the previous hash
        previousHash = hash;

        log("Map choreography updated successfully.");
      } catch (error) {
        console.error("Error updating map choreography:", error);
      }
    }

    // Add reset animation button
    resetButton.addEventListener("click", () => {
      const config = choreographyMapping[hash];
      if (config) {
        // Reset the time slider to its initial state
        timeSlider.timeExtent = {
          start: null,
          end: new Date(config.timeSliderStart)
        };
  
        // Replay the animation
        if (timeSlider.state === "ready") {
          timeSlider.play();
        }
  
        log("Animation reset and replayed.");
      } else {
        console.error("No configuration found for the current hash.");
      }
    });


    // Call the updateMapChoreography function to set the initial state
    updateMapChoreography()
    // Listen for hash changes and update the choreography
    window.addEventListener("hashchange", async () => {
      await updateMapChoreography();
    });
  }
});