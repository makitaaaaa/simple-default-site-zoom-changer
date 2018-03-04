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

  /**
   * @param {number} tabId 
   * @param {object} changeInfo 
   * @param {browser.tabs.Tab} tab 
   */
  const onTabUpdated = async (tabId, changeInfo, tab) => {
    try {
      if (isInvalidUrl(changeInfo)) {
        return;
      }
      if (isDefaultZoomFactor(commonSettings.zoomLevelFactor)) {
        return;
      }
      if (tab.status !== "loading") {
        return;
      }

      let hostname = getHostname(changeInfo.url);
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
      browser.tabs.setZoom(tabId, commonSettings.zoomLevelFactor);
    } catch (e) {
      logging(e);
    }
  }

  /**
   * @param {ZoomChangeInfo} zoomChangeInfo 
   */
  const onZoomChanged = async (zoomChangeInfo) => {
    try {
      let tabId = zoomChangeInfo.tabId;
      let oldZoomFactor = zoomChangeInfo.oldZoomFactor;
      let newZoomFactor = zoomChangeInfo.newZoomFactor;
      if (isDefaultZoomFactor(oldZoomFactor) && isAddonZoomFactor(newZoomFactor) && addonChangeZoomTabIdSet.delete(tabId)) {
        // from addon
        return;
      }
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
   * @param {object} urlObject 
   * @param {string} urlObject.url
   * @return {boolean}
   */
  const isInvalidUrl = (urlObject) => {
    if (!urlObject.hasOwnProperty("url")) {
      return true;
    }
    if (urlObject.url.startsWith("about:")) {
      return true;
    }
    if (urlObject.url.startsWith("file:")) {
      return true;
    }
    return false;
  }

  /**
   * @param {number} zoomFactor 
   * @return {boolean} 
   */
  const isDefaultZoomFactor = (zoomFactor) => {
    return zoomFactor === ZOOM_FACTOR_DEFAULT;
  }

  /**
   * @param {number} zoomFactor 
   * @return {boolean} 
   */
  const isAddonZoomFactor = (zoomFactor) => {
    return zoomFactor === commonSettings.zoomLevelFactor;
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

      browser.tabs.onUpdated.addListener(onTabUpdated);
      browser.tabs.onZoomChange.addListener(onZoomChanged);
      browser.storage.onChanged.addListener(onStorageChange);
    } catch (e) {
      logging(e);
    }
  }

  initialize();
})();