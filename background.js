"use strict";

/* global StorageKey, logging, setStorageItem, getStorageItem */

(function () {
  /** @typedef {{zoomLevelFactor:number, zoomLevelInput:number}} CommonSettings */
  /** @typedef {{tabId:number,oldZoomFactor:number,newZoomFactor:number,zoomSettings:browser.tab.ZoomSettings}} ZoomChangeInfo */

  /** @type {Map<string,number>} */
  let zoomSiteMap = new Map();

  /** @type {number} */
  const ZOOM_FACTOR_DEFAULT = 1;

  /** @type {CommonSettings} */
  let commonSettings = {};
  let zoomSiteSettings = {};
  /** @type {Set<number>} */
  let addonChangeZoomTabIdSet = new Set();

  /** @type {Set<number>} */
  let userZoomStatusTabIdSet = new Set();

  /**
   * @param {object} details 
   */
  const onWebNavigationDOMContentLoaded = async (details) => {
    if (details.frameId !== 0) {
      return;
    }
    let tabId = details.tabId;
    try {
      let hostname = getHostname(details.url);
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
      addonChangeZoomTabIdSet.add(tabId);
      if (!isDefaultZoomFactor(commonSettings.zoomLevelFactor)) {
        await browser.tabs.setZoom(tabId, commonSettings.zoomLevelFactor);
      }
    } catch (e) {
      logging(e);
    } finally {
      userZoomStatusTabIdSet.add(tabId);
    }
  }

  /**
   * @param {ZoomChangeInfo} zoomChangeInfo 
   */
  const onZoomChanged = (zoomChangeInfo) => {
    if (!userZoomStatusTabIdSet.has(zoomChangeInfo.tabId)) {
      return;
    }
    onZoomChangedImplements(zoomChangeInfo);
  }

  /**
   * @param {ZoomChangeInfo} zoomChangeInfo 
   */
  const onZoomChangedImplements = async (zoomChangeInfo) => {
    try {
      let tabId = zoomChangeInfo.tabId;
      let oldZoomFactor = zoomChangeInfo.oldZoomFactor;
      let newZoomFactor = zoomChangeInfo.newZoomFactor;

      let tab = await browser.tabs.get(tabId);
      if (isInvalidUrl(tab)) {
        return;
      }
      let hostname = getHostname(tab.url);

      if (isDefaultZoomFactor(newZoomFactor)) {
        zoomSiteMap.set(hostname, newZoomFactor);
        zoomSiteSettings[hostname] = newZoomFactor;
      } else {
        zoomSiteMap.delete(hostname);
        delete zoomSiteSettings[hostname];
      }
      if (isDefaultZoomFactor(newZoomFactor) || isDefaultZoomFactor(oldZoomFactor)) {
        setStorageItem(StorageKey.ZoomSite, zoomSiteSettings);
      }
    } catch (e) {
      logging(e);
    }
  }

  /**
   * @param {object} details 
   */
  const onWebNavigationBeforeNavigate = (details) => {
    if (details.frameId !== 0) {
      return;
    }
    userZoomStatusTabIdSet.delete(details.tabId);
  }

  /**
   * @param {number} tabId 
   * @param {object} removeInfo 
   */
  const onTabRemoved = (tabId, removeInfo) => {
    userZoomStatusTabIdSet.delete(tabId);
  }

  /**
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
   * @param {number} zoomFactor 
   * @return {boolean} 
   */
  const isDefaultZoomFactor = (zoomFactor) => {
    return zoomFactor === ZOOM_FACTOR_DEFAULT;
  }

  /**
   * @param {string} strUrl URL
   */
  const getHostname = (strUrl) => {
    const url = new URL(strUrl);
    return url.hostname;
  }

  /**
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
   * 
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

      /** @type {browser.webNavigation.EventUrlFilters} */
      const URL_FILTER = {
        url: [{
          schemes: ["http", "https"]
        }]
      }

      browser.webNavigation.onDOMContentLoaded.addListener(onWebNavigationDOMContentLoaded, URL_FILTER);
      browser.webNavigation.onBeforeNavigate.addListener(onWebNavigationBeforeNavigate);
      browser.tabs.onZoomChange.addListener(onZoomChanged);
      browser.tabs.onRemoved.addListener(onTabRemoved);
      browser.storage.onChanged.addListener(onStorageChange);
    } catch (e) {
      logging(e);
    }
  }

  initialize();
})();