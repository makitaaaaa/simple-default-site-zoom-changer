"use strict";

/* global StorageKey, logging, setStorageItem, getStorageItem */

(function () {
  /** @typedef {{zoomLevelFactor:number, zoomLevelInput:number}} CommonSettings */
  /** @typedef {{tabId:number,oldZoomFactor:number,newZoomFactor:number,zoomSettings:browser.tab.ZoomSettings}} ZoomChangeInfo */

  /** @type {Map<string,number>} host,zoomfactor(only x1) */
  let zoomSiteMap = new Map();

  /** @type {number} */
  const ZOOM_FACTOR_DEFAULT = 1;

  /** @type {number} */
  const ZOOM_EVENT_DELAY_MS = 500;

  /** @type {CommonSettings} */
  let commonSettings = {};
  let zoomSiteSettings = {};

  /** @type {Map<number, string>} tabId, host */
  let userZoomStatusTabIdMap = new Map();

  /**
   * handle zoom changed
   * @param {ZoomChangeInfo} zoomChangeInfo 
   */
  const onZoomChanged = (zoomChangeInfo) => {
    let tabId = zoomChangeInfo.tabId;
    let url = userZoomStatusTabIdMap.get(tabId);
    if (!url) {
      return;
    }
    let oldZoomFactor = zoomChangeInfo.oldZoomFactor;
    let newZoomFactor = zoomChangeInfo.newZoomFactor;

    if (isInvalidUrl({url:url})) {
      return;
    }
    let hostname = getHostname(url);
    setTimeout(() => {
      let currentUrl = userZoomStatusTabIdMap.get(tabId);
      if (!currentUrl) {
        return;
      }
      let currentHostname = getHostname(currentUrl);
      if (hostname !== currentHostname) {
        return;
      }
      if (isDefaultZoomFactor(newZoomFactor)) {
        zoomSiteMap.set(hostname, newZoomFactor);
        zoomSiteSettings[hostname] = newZoomFactor;
      } else {
        zoomSiteMap.delete(hostname);
        delete zoomSiteSettings[hostname];
      }
      if (isDefaultZoomFactor(newZoomFactor) || isDefaultZoomFactor(oldZoomFactor)) {
        // save zoom settings (x1 zoom)
        setStorageItem(StorageKey.ZoomSite, zoomSiteSettings);
      }
    }, ZOOM_EVENT_DELAY_MS);

  }

  /**
   * handle tab removed
   * @param {number} tabId 
   * @param {object} removeInfo 
   */
  const onTabRemoved = (tabId, removeInfo) => {
    userZoomStatusTabIdMap.delete(tabId);
  }

  /**
   * check invalid url
   * @param {object} urlObject 
   * @param {string} urlObject.url
   * @return {boolean}
   */
  const isInvalidUrl = (urlObject) => {
    if (!urlObject.hasOwnProperty("url")) {
      return true;
    }
    return !urlObject.url.startsWith("http");
  }

  /**
   * check default zoom factor (x1)
   * @param {number} zoomFactor 
   * @return {boolean} 
   */
  const isDefaultZoomFactor = (zoomFactor) => {
    return zoomFactor === ZOOM_FACTOR_DEFAULT;
  }

  /**
   * get hostname
   * @param {string} strUrl URL
   */
  const getHostname = (strUrl) => {
    const url = new URL(strUrl);
    return url.hostname;
  }

  /**
   * handle storage changed
   * @param {browser.storage.StorageChange} changes 
   * @param {browser.storage.StorageArea} area 
   */
  const onStorageChange = async (changes, area) => {
    if (!changes.settings) {
      return;
    }
    commonSettings = changes.settings.newValue;
  }

/**
 * handle message
 * @param {*} request 
 * @param {*} sender 
 * @param {*} sendResponse 
 */
const handleMessage = (request, sender, sendResponse) => {
  if (request === null || request === undefined || !(request.to) || request.to !== "background") {
    return false;
  }
  
  if (request.from === "content" && request.method === "changeZoom") {
    changeZoom(request, sender, sendResponse);
    return false;
  }
  return false;
}


/**
 * change zoom
 * @param {*} request 
 * @param {browser.runtime.MessageSender} sender 
 * @param {*} sendResponse 
 */
const changeZoom = async (request, sender, sendResponse) => {
  let senderTab = sender.tab;
  let tabId = senderTab.id;
  let url = sender.url;

  try {
    userZoomStatusTabIdMap.set(tabId, url);

    let hostname = getHostname(url);
    let zoomFactor = await browser.tabs.getZoom(tabId);
    if (!isDefaultZoomFactor(zoomFactor)) {
      return;
    }
    // zoom x1 (default)
    let hostZoomFactor = zoomSiteMap.get(hostname);
    if (hostZoomFactor) {
      // exists host setting (x1 zoom)
      return;
    }
    // not exists host setting (addon default zoom)
    if (!isDefaultZoomFactor(commonSettings.zoomLevelFactor)) {
      browser.tabs.setZoom(tabId, commonSettings.zoomLevelFactor);
    }
  } catch (e) {
    logging(e);
  }
}
  /** 
   * initialize
   */
  const initialize = async () => {
    try {
      let loadSettigns = await getStorageItem(StorageKey.Settings);
      let loadZoomSiteSettings = await getStorageItem(StorageKey.ZoomSite);
      let defaultSettings = {};
      let defaultSiteSettings = {};

      defaultSettings.zoomLevelFactor = ZOOM_FACTOR_DEFAULT;
      defaultSettings.zoomLevelInput = ZOOM_FACTOR_DEFAULT * 100;
      commonSettings = Object.assign(defaultSettings, loadSettigns);
      zoomSiteSettings = Object.assign(defaultSiteSettings, loadZoomSiteSettings);
      await setStorageItem(StorageKey.Settings, commonSettings);
      await setStorageItem(StorageKey.ZoomSite, zoomSiteSettings);
      for (let siteName in zoomSiteSettings) {
        zoomSiteMap.set(siteName, zoomSiteSettings[siteName]);
      }
      
      browser.runtime.onMessage.addListener(handleMessage);
      browser.tabs.onZoomChange.addListener(onZoomChanged);
      browser.tabs.onRemoved.addListener(onTabRemoved);
      browser.storage.onChanged.addListener(onStorageChange);
    } catch (e) {
      logging(e);
    }
  }

  initialize();
})();