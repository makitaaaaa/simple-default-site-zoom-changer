"use strict";

/* eslint no-unused-vars: 0 */

const StorageKey = {
  Settings: "settings",
  ZoomSite: "zoomSite"
}

/**
 * 
 * @param {[*]} args 
 */
const logging = (...args) => {
  // eslint-disable-next-line no-console
  console.log(...args);
}

/**
 * @param {string} key 
 * @param {*} val 
 */
const setStorageItem = async (key, val) => {
  let item = {};
  item[key] = val;
  chrome.storage.local.set(item);
}

/**
 * @param {string} key 
 * @return {*}
 */
const getStorageItem = async (key) => {
  let item = await browser.storage.local.get(key);
  return item[key];
}

let delayInvokeTimer = 0;

const delayInvoke = (() => {
  return (callback, ms) => {
    clearTimeout(delayInvokeTimer);
    delayInvokeTimer = setTimeout(callback, ms);
  };
})();