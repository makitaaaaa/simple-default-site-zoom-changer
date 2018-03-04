// オプションページ

"use strict";

/* global StorageKey, logging, delayInvoke, setStorageItem, getStorageItem */

(function () {
  let settings = null;

  const numberZoomLevelInputElement = document.getElementById("zoom-level-input");
  const numberZoomLevelFactorElement = document.getElementById("zoom-level-factor");

  /** 
   * 
   */
  const initialize = async () => {
    try {
      settings = await getStorageItem(StorageKey.Settings);
      const onUpdatedElementValueForInput = (evt) => {
        delayInvoke(() => {
          try {
            numberZoomLevelFactorElement.valueAsNumber = evt.target.valueAsNumber / 100;
            if (!evt.target.validity.valid) {
              return;
            }
            saveConfigValue(evt.target);
            saveConfigValue(numberZoomLevelFactorElement);
            setStorageItem(StorageKey.Settings, settings);
          } catch (e) {
            logging(e);
          }
        }, 100)
      };
      loadConfigValue(numberZoomLevelInputElement);
      loadConfigValue(numberZoomLevelFactorElement);

      numberZoomLevelInputElement.addEventListener("input", onUpdatedElementValueForInput, false);
      numberZoomLevelInputElement.addEventListener("change", onUpdatedElementValueForInput, false);
      let mainForm = document.getElementById("main-form");
      mainForm.style.removeProperty("visibility");
    } catch (e) {
      logging(e);
    }
  };

  /**
   * @param {HTMLElement} element 
   * @return {number|string}
   */
  const getElementValue = (element) => {
    if (element.tagName === "INPUT") {
      switch (element.type) {
        case "checkbox":
          return element.checked === true;
        case "text":
        case "color":
          return element.value;
        case "number":
        case "range":
          return element.valueAsNumber;
        case "radio":
          for (let radioElm of document.getElementsByName(element.name)) {
            if (radioElm.checked === true) {
              return radioElm.value;
            }
          }
          break;
        default:
          return;
      }
    } else if (element.tagName === "TEXTAREA") {
      return element.value;
    }
  }

  /**
   * @param {HTMLElement} element 
   */
  const saveConfigValue = (element) => {
    if (!element.validity.valid) {
      return;
    }
    let configKey = element.getAttribute("data-storage-key");
    settings[configKey] = getElementValue(element);
  }

  /**
   * @param {HTMLElement} element 
   */
  const loadConfigValue = (element) => {
    let configKey = element.getAttribute("data-storage-key");
    let value = settings[configKey];
    if (!value) {
      return;
    }
    if (element.tagName === "INPUT") {
      switch (element.type) {
        case "checkbox":
          element.checked = value;
          break;
        case "text":
        case "color":
          element.value = value;
          break;
        case "number":
        case "range":
          element.valueAsNumber = value;
          break;
        case "radio":
          for (let radioElm of document.getElementsByName(element.name)) {
            if (radioElm.value === value) {
              radioElm.checked = true;
              break;
            }
          }
          break;
        default:
          return;
      }
    } else if (element.tagName === "TEXTAREA") {
      element.value = value;
    }
  }

  initialize();
})();