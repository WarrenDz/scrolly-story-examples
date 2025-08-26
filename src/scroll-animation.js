// Set DEBUG to true to enable debug logging
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}


// Node selectors for the story map
// These selectors are used to identify the main container and iframe within the story map.
// Can these selectors be made more dynamic?
// Could the node also be stored as a k,v in the mapChoreography (if the mapChoreography was a dict)?
// -- This would facilitate choreography sequences spread across multiple sidecars.
// -- Ultimately, this would also allow for the js to contain more of the logic, rather than the unique configuration.
const rootSelector = "#n-wrgjVr";
const targetSelectorDocked = `${rootSelector} > div > div[class*='jsx-'][class*='container'][class*='main']`;
const iframeSelector = `${rootSelector} iframe`;
log("Using rootSelector:", rootSelector);
log("Using targetSelectorDocked:", targetSelectorDocked);
log("Using iframeSelector:", iframeSelector);
// Note:
// docked layout = partial-screen
// floating layout = full-screen

// --- Shared state ---
// This file contains shared state variables used across the scroll-driven story map
let isDocked = false;
let dockStartScroll = null;

let lastScrollY = window.scrollY;
let scrollDirection = "down"; // or 'up';
let currentSlide = 0;

// --- Configuration ---
// This file contains the configurable parameters for the scroll-driven story map
let mapChoreography;

// Calculates the height of a narrative panel, adjusting for margins and padding based on its position (first, last, or middle).
function getPanelHeight(panel) {
  return panel.classList.contains("first")
    ? panel.offsetHeight - parseFloat(getComputedStyle(panel).marginTop)
    : panel.classList.contains("last")
    ? panel.offsetHeight - parseFloat(getComputedStyle(panel).paddingBottom)
    : panel.offsetHeight +
      parseFloat(getComputedStyle(panel).marginBottom) +
      parseFloat(getComputedStyle(panel).marginTop);
}

// Determines the scroll start and end positions for the current panel, used to track scroll progress.
function getPanelScrollBounds(panels, currentSlide) {
  let panelStartScroll = dockStartScroll;

  for (let i = 0; i < currentSlide; i++) {
    panelStartScroll += getPanelHeight(panels[i]);
  }

  const panelHeight = getPanelHeight(panels[currentSlide]);
  const panelEndScroll = panelStartScroll + panelHeight;

  return { panelStartScroll, panelEndScroll };
}

// Waits for a specific DOM element to be available before executing a callback function.
function waitForElement(selector, callback) {
  const interval = setInterval(() => {
    const element = document.querySelector(selector);
    if (element) {
      clearInterval(interval);
      callback(element);
    }
  }, 100);
}

// Creates a MutationObserver to monitor changes to the 'src' attribute of an iframe and updates the current slide accordingly.
const createIframeSrcObserver = (iframe) => {
  return new MutationObserver(() => {
    const newSrc = iframe.getAttribute("src") || "";
    const parts = newSrc.split("#");
    const slideNumber = parseInt(parts.length > 1 ? parts.pop() : "0", 10);
    currentSlide = isNaN(slideNumber) ? 0 : slideNumber;
    log("Updated current slide:", currentSlide);
  });
};

// --- Main logic ---

// Sets up a scroll listener to track the scroll direction and current scroll position.
// This is used to determine when the user scrolls down or up, which can affect the docking state.
function setupDockingObserver() {
  waitForElement(targetSelectorDocked, (target) => {
    const observer = new MutationObserver(() => {
      const currentlyDocked = target.classList.contains("docked");

      if (currentlyDocked && !isDocked) {
        isDocked = true;
        const currentScroll = window.scrollY;
        log(currentScroll, scrollDirection);

        if (scrollDirection === "down") {
          dockStartScroll = currentScroll;
        }

        log("Docked: Starting scroll tracking at", dockStartScroll);
      }

      if (!currentlyDocked && isDocked) {
        isDocked = false;
      }
    });

    observer.observe(target, { attributes: true, attributeFilter: ["class"] });

    log("Docking observer attached.");
  });
}

let iframe = null
function watchForIframeForever() {
  iframe = document.querySelector(iframeSelector);
  // This selector should match the root element where the iframe is expected to be found.
  // rootSelector gets used here
  waitForElement(
    rootSelector,
    (root) => {
      const observer = new MutationObserver(() => {
        const iframe = root.querySelector("iframe");
        if (iframe && !iframe.dataset.observed) {
          log(
            `Frame (re)found under ${rootSelector} attaching observer.`
          );
          iframe.dataset.observed = "true";
          // Default to slide 0 in case src isn't immediately populated
          currentSlide = 0;

          // Send postMessage to inform iframe it's embedded
          iframe.contentWindow.postMessage(
            {
              source: "storymap-controller",
              payload: { isEmbedded: true }
            },
            "*"
          );

          // Watch for future src changes
          const srcObserver = createIframeSrcObserver(iframe);
          srcObserver.observe(iframe, {
            attributes: true,
            attributeFilter: ["src"],
          });
        }
      });

      observer.observe(root, { childList: true, subtree: true });
      log(`Watching ${rootSelector} for iframe (re)insertion.`);
    } // (root)=>
  );
}

// --- Scroll listener ---

// Calculates the progress of the current panel based on the scroll position and the panel's scroll bounds.
function getPanelProgress(panels, currentSlide, scrollY) {
  const { panelStartScroll, panelEndScroll } = getPanelScrollBounds(
    panels,
    currentSlide
  );
  let progress =
    (scrollY - panelStartScroll) / (panelEndScroll - panelStartScroll);
  return Math.max(0, Math.min(1, progress));
}

// Sets up a scroll listener that tracks the user's scroll position and updates the current slide's progress.
function setupScrollListener(onProgress) {
  window.addEventListener("scroll", () => {
    log("Scroll event fired"); // Add this line
    const currentScroll = window.scrollY;
    scrollDirection =
      currentScroll > lastScrollY
        ? "down"
        : currentScroll < lastScrollY
        ? "up"
        : scrollDirection;
    lastScrollY = currentScroll;

    if (!isDocked || dockStartScroll === null) return;

    const panels = document.querySelectorAll("div.immersive-narrative-panel");
    if (currentSlide < panels.length) {
      const progress = getPanelProgress(panels, currentSlide, currentScroll);
      if (typeof onProgress === "function") {
        onProgress(progress, currentSlide);
      }
    }
  });
}


// Example interpolation functions
function interpolateCamera(progress, slide) {
  const choreo = mapChoreography[slide];
  const nextIndex = Math.min(slide + 1, mapChoreography.length - 1);
  const from = choreo.result;
  const to = mapChoreography[nextIndex].result;
  const interpolate = (fromVal, toVal) =>
    fromVal + (toVal - fromVal) * progress;
  const camera = {
    x: interpolate(from.x, to.x),
    y: interpolate(from.y, to.y),
    z: interpolate(from.z, to.z),
    tilt: interpolate(from.tilt, to.tilt),
    heading: interpolate(from.heading, to.heading),
    fov: to.fov || 100,
  };
  const iframe = document.querySelector(iframeSelector);
  iframe.contentWindow.postMessage(
    { source: "storymap-controller", payload: camera },
    "*"
  );
}

// Add more interpolation functions as needed
function interpolateTimeSlider(progress, slide) {
  const choreo = mapChoreography[slide];
  const from = new Date(choreo.timeSlider.timeSliderStart);
  const to = new Date(choreo.timeSlider.timeSliderEnd);
  const step = choreo.timeSlider.timeSliderStep;
  const unit = choreo.timeSlider.timeSliderUnit;
  let interpolate = (fromVal, toVal) => fromVal + (toVal - fromVal) * progress;
  const pct = (progress * 100).toFixed(2) + "%";
  log("Interpolating time from:", new Date(from), "to:", new Date(to), "progress:", pct);
  // Optional: Snap to step/unit
  if (step && unit) {
    let msPerStep;
    switch (unit) {
      case "day":
        msPerStep = step * 24 * 60 * 60 * 1000;
        break;
      case "hour":
        msPerStep = step * 60 * 60 * 1000;
        break;
      case "minute":
        msPerStep = step * 60 * 1000;
        break;
      case "second":
        msPerStep = step * 1000;
        break;
      case "month":
        // For months, you may want to use a date library for accuracy
        msPerStep = step * 30 * 24 * 60 * 60 * 1000;
        break;
      case "year":
        msPerStep = step * 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        msPerStep = step;
    }
    interpolate = Math.round(interpolate / msPerStep) * msPerStep;
  }

  const timepoint = new Date(interpolate).toISOString();
  log("Interpolated timepoint:", timepoint);
  const iframe = document.querySelector(iframeSelector);
  iframe.contentWindow.postMessage(
    { source: "storymap-controller", payload: { type: "timeSlider", timepoint } },
    "*"
  );
}

// Function to interpolate  between map extents
function interpolateMapExtent(progress, slide) {
  const choreo = mapChoreography[slide];
  const nextIndex = Math.min(slide + 1, mapChoreography.length - 1);
  const from = choreo.viewpoint;
  const to = mapChoreography[nextIndex].viewpoint;
  const pct = (progress * 100).toFixed(2) + "%";
  log("Interpolating extent from:", from, "to:", to, "progress:", pct);
  const interpolate = (fromVal, toVal) =>
    fromVal + (toVal - fromVal) * progress;
  const viewpoint = {
    scale: interpolate(from.scale, to.scale),
    rotation: interpolate(from.rotation, to.rotation),
    targetGeometry: {
      xmin: interpolate(from.xmax, to.xmin),
      ymin: interpolate(from.ymin, to.ymin),
      xmax: interpolate(from.xmax, to.xmax),
      ymax: interpolate(from.ymax, to.ymax),
    },
  };
  const iframe = document.querySelector(iframeSelector);
  iframe.contentWindow.postMessage(
    { source: "storymap-controller", payload: { type: "viewpoint", viewpoint } },
    "*"
  );
}

// Register all interpolation functions you want to run
const interpolators = [interpolateMapExtent, interpolateTimeSlider];

// Generic interpolation runner
function runInterpolations(interpolators, progress, slide) {
  const pct = (progress * 100).toFixed(2) + "%";
  log("runInterpolations called", { pct, slide });
  interpolators.forEach((fn) => {
    if (typeof fn === "function") {
      fn(progress, slide);
    }
  });
}

// Set up observers and listeners for docking, iframe changes, and scroll events.
async function initialize() {
  // Load the map choreography data
  const response = await fetch("./public/mapChoreography.json");
  mapChoreography = await response.json();
  setupDockingObserver();
  watchForIframeForever();

  // Call interpolations on scroll progress
  setupScrollListener((progress, slide) => {
    runInterpolations(interpolators, progress, slide);
  });
}
initialize();
