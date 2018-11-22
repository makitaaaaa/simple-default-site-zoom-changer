"use strict";

(function () {
  /** @type {boolean} */
  let isUnloaded = false;

  /** @type {number} */
  const ZOOM_EVENT_DELAY_MS = 100;

  document.addEventListener("DOMContentLoaded", (event) => {
    if (isUnloaded) {
      return;
    }
    setTimeout(() => {
      if (isUnloaded) {
        return;
      }
      browser.runtime.sendMessage({
        from: "content",
        to: "background",
        method: "changeZoom"
      });
    }, ZOOM_EVENT_DELAY_MS);
  });

  window.addEventListener("beforeunload", (event) => {
    isUnloaded = true;
  });
})();