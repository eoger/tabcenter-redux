const SideTab = require("./tab.js");
const ContextMenu = require("./contextmenu.js");

const COMPACT_MODE_OFF = 0;
const COMPACT_MODE_DYNAMIC = 1;
const COMPACT_MODE_STRICT = 2;

function SideTabList() {
  this.tabs = new Map();
  this.active = null;
  this.compactModeMode = COMPACT_MODE_OFF;
  this._compactPins = true;
  this._tabsShrinked = false;
  this.windowId = null;
  this._filterActive = false;
  this.view = document.getElementById("tablist");
  this.pinnedview = document.getElementById("pinnedtablist");
  this._wrapperView = document.getElementById("tablist-wrapper");
  this._resizeCanvas = document.createElement("canvas");
  this._resizeCanvas.mozOpaque = true;
  this._resizeCanvasCtx = this._resizeCanvas.getContext("2d");
}

SideTabList.prototype = {
  async init() {
    this.setupListeners();
    await this.readPrefs();
  },
  setupListeners() {
    this._spacerView = document.getElementById("spacer");
    this._moreTabsView = document.getElementById("moretabs");

    // Tab events
    browser.tabs.onActivated.addListener(({tabId}) => this.onBrowserTabActivated(tabId));
    browser.tabs.onCreated.addListener(tab => this.create(tab));
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
                                       this.onBrowserTabUpdated(tabId, changeInfo, tab));
    browser.tabs.onRemoved.addListener(tabId => this.remove(tabId));
    browser.tabs.onMoved.addListener((tabId, moveInfo) => this.onBrowserTabMoved(tabId, moveInfo));
    browser.tabs.onAttached.addListener(async tabId => {
      let tab = await browser.tabs.get(tabId);
      tab.id = tabId; // Replace the ID by the new tab ID (they are different!).
      this.create(tab);
    });
    browser.tabs.onDetached.addListener(tabId => this.remove(tabId));

    // Global ("event-bubbling") listeners
    // Because defining event listeners for each tab is a terrible idea.
    // Read more here: https://davidwalsh.name/event-delegate
    this.view.addEventListener("click", e => this.onClick(e));
    this.view.addEventListener("auxclick", e => this.onAuxClick(e));
    this.view.addEventListener("mousedown", e => this.onMouseDown(e));
    this.view.addEventListener("contextmenu", e => this.onContextMenu(e));
    this.view.addEventListener("animationend", e => this.onAnimationEnd(e));
    this.pinnedview.addEventListener("click", e => this.onClick(e));
    this.pinnedview.addEventListener("auxclick", e => this.onAuxClick(e));
    this.pinnedview.addEventListener("mousedown", e => this.onMouseDown(e));
    this.pinnedview.addEventListener("contextmenu", e => this.onContextMenu(e));
    this.pinnedview.addEventListener("animationend", e => this.onAnimationEnd(e));
    window.addEventListener("keyup", (e) => {
      if (e.keyCode === 27) { // Context menu closed on ESC key pressed
        this.hideContextMenu();
      }
    });
    window.addEventListener("click", e => {
      if (e.which == 1) {
        this.hideContextMenu();
      }
    });
    window.addEventListener("blur", () => {
      this.hideContextMenu();
    });

    this._spacerView.addEventListener("dblclick", () => this.onSpacerDblClick());
    this._spacerView.addEventListener("auxclick", e => this.onSpacerAuxClick(e));
    this._moreTabsView.addEventListener("click", () => this.clearSearch());

    // Drag-and-drop
    document.addEventListener("dragstart", e => this.onDragStart(e));
    document.addEventListener("dragover", e => this.onDragOver(e));
    document.addEventListener("drop", e => this.onDrop(e));

    // Pref changes
    browser.storage.onChanged.addListener(changes => {
      if (changes.compactModeMode) {
        this.compactModeMode = changes.compactModeMode.newValue;
        this.maybeShrinkTabs();
      }
      if (changes.compactPins) {
        this.compactPins = changes.compactPins.newValue;
        this.maybeShrinkTabs();
      }
    });
  },
  async readPrefs() {
    const prefs = (await browser.storage.local.get({
      compactModeMode: COMPACT_MODE_DYNAMIC,
      compactPins: true
    }));
    this.compactModeMode = prefs.compactModeMode;
    if (this.compactModeMode != COMPACT_MODE_OFF) {
      this.maybeShrinkTabs();
    }
    this.compactPins = prefs.compactPins;
  },
  onBrowserTabActivated(tabId) {
    this.setActive(tabId);
    this.updateTabThumbnail(tabId);
    this.scrollToActiveTab();
  },
  onBrowserTabMoved(tabId, moveInfo) {
    this.setPos(tabId, moveInfo.fromIndex < moveInfo.toIndex ?
                       moveInfo.toIndex + 1: moveInfo.toIndex
    );
  },
  onBrowserTabUpdated(tabId, changeInfo, tab) {
    if (!this.checkWindow(tab)) {
      return;
    }
    if (changeInfo.hasOwnProperty("title")) {
      this.setTitle(tab);
    }
    if (changeInfo.hasOwnProperty("favIconUrl")) {
      this.setIcon(tab);
    }
    if (changeInfo.hasOwnProperty("url")) {
      this.setURL(tab);
    }
    if (changeInfo.hasOwnProperty("mutedInfo")) {
      this.setMuted(tab);
    }
    if (changeInfo.hasOwnProperty("audible")) {
      this.setAudible(tab);
    }
    if (changeInfo.hasOwnProperty("status") && changeInfo.status === "loading") {
      this.setLoading(tab, true);
    }
    if (changeInfo.hasOwnProperty("status") && changeInfo.status === "complete") {
      this.setLoading(tab, false);
      this.updateTabThumbnail(tabId);
      if (tab.hasOwnProperty("favIconUrl")) {
        this.setIcon(tab);
      }
    }
    if (changeInfo.hasOwnProperty("pinned")) {
      this.setPinned(tab);
    }
    if (changeInfo.hasOwnProperty("discarded")) {
      this.setDiscarded(tab);
    }
  },
  onMouseDown(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (e.which == 1 && SideTab.isTabEvent(e)) {
      browser.tabs.update(SideTab.tabIdForEvent(e), {active: true});
      return;
    }
    // Prevent autoscrolling on middle click
    if (e.which == 2) {
      e.preventDefault();
      return;
    }
  },
  onAuxClick(e) {
    if (e.which == 2 && SideTab.isTabEvent(e, false)) {
      browser.tabs.remove(SideTab.tabIdForEvent(e));
      e.preventDefault();
      return;
    }
  },
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.hide();
      this.contextMenu = null;
    }
  },
  onContextMenu(e) {
    this.hideContextMenu();
    e.preventDefault();
    if (!SideTab.isTabEvent(e, false)) {
      return;
    }
    const tabId = SideTab.tabIdForEvent(e);
    const items = this.createContextMenuItems(tabId);
    this.contextMenu = new ContextMenu(e.clientX, e.clientY, items);
    this.contextMenu.show();
  },
  createContextMenuItems(tabId) {
    const tab = this.getTabById(tabId);
    const items = [];
    items.push({
      label: browser.i18n.getMessage("contextMenuReloadTab"),
      onCommandFn: () => {
        browser.tabs.reload(tabId);
      }
    });
    items.push({
      label: browser.i18n.getMessage(tab.muted ? "contextMenuUnmuteTab" :
                                                 "contextMenuMuteTab"),
      onCommandFn: () => {
        browser.tabs.update(tabId, {"muted": !tab.muted});
      }
    });
    items.push({
      label: "separator"
    });
    items.push({
      label: browser.i18n.getMessage(tab.pinned ? "contextMenuUnpinTab" :
                                                  "contextMenuPinTab"),
      onCommandFn: () => {
        browser.tabs.update(tabId, {"pinned": !tab.pinned});
      }
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuDuplicateTab"),
      onCommandFn: () => {
        browser.tabs.duplicate(tabId);
      }
    });
    if (this.tabs.size > 1) {
      items.push({
        label: browser.i18n.getMessage("contextMenuMoveTabToNewWindow"),
        onCommandFn: () => {
          browser.windows.create({ tabId });
        }
      });
    }
    items.push({
      label: "separator"
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuReloadAllTabs"),
      onCommandFn: () => {
        for (let tab of this.tabs.values()) {
          browser.tabs.reload(tab.id);
        }
      }
    });
    if (!tab.pinned) {
      items.push({
        label: browser.i18n.getMessage("contextMenuCloseTabsUnderneath"),
        onCommandFn: () => {
          const tabPos = this.getPos(tabId);
          const orderedIds = [...SideTab.getAllTabsViews()].map(el => parseInt(SideTab.tabIdForView(el)));
          browser.tabs.remove(orderedIds.slice(tabPos + 1));
        }
      });
      items.push({
        label: browser.i18n.getMessage("contextMenuCloseOtherTabs"),
        onCommandFn: () => {
          const toClose = [...this.tabs.values()]
                          .filter(tab => tab.id != tabId && !tab.pinned)
                          .map(tab => tab.id);
          browser.tabs.remove(toClose);
        }
      });
    }
    items.push({
      label: "separator"
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuUndoCloseTab"),
      isEnabled: async () => {
        const undoTabs = await this._getRecentlyClosedTabs();
        return undoTabs.length;
      },
      onCommandFn: async () => {
        const undoTabs = await this._getRecentlyClosedTabs();
        if (undoTabs.length) {
          browser.sessions.restore(undoTabs[0].sessionId);
        }
      }
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuCloseTab"),
      onCommandFn: () => {
        browser.tabs.remove(tabId);
      }
    });
    return items;
  },
  async _getRecentlyClosedTabs() {
    const sessions = await browser.sessions.getRecentlyClosed();
    return sessions.map(s => s.tab)
                   .filter(s => s && this.checkWindow(s));
  },
  onClick(e) {
    if (SideTab.isCloseButtonEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      browser.tabs.remove(tabId);
    } else if (SideTab.isIconOverlayEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      const tab = this.getTabById(tabId);
      browser.tabs.update(tabId, {"muted": !tab.muted});
    }
  },
  onDragStart(e) {
    if (!SideTab.isTabEvent(e)) {
      return;
    }
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    e.dataTransfer.setData("text/x-tabcenter-tab", JSON.stringify({
      tabId: parseInt(SideTab.tabIdForEvent(e)),
      origWindowId: this.windowId
    }));
    e.dataTransfer.setData("text/x-moz-place", JSON.stringify({
      type: "text/x-moz-place",
      title: tab.title,
      uri: tab.url
    }));
    e.dataTransfer.dropEffect = "move";
  },
  onDragOver(e) {
    e.preventDefault();
  },
  _findMozURL(dataTransfer) {
    const urlData = dataTransfer.getData("text/x-moz-url-data"); // page link
    if (urlData) {
      return urlData;
    }
    const mozPlaceData = dataTransfer.getData("text/x-moz-place"); // bookmark
    if (mozPlaceData) {
      return JSON.parse(mozPlaceData).uri;
    }
    return null;
  },
  onDrop(e) {
    if (!SideTab.isTabEvent(e, false) &&
        e.target != this._spacerView &&
        e.target != this._moreTabsView) {
      return;
    }
    e.preventDefault();

    const dt = e.dataTransfer;
    const tabStr = dt.getData("text/x-tabcenter-tab");
    if (tabStr) {
      return this.handleDroppedTabCenterTab(e, JSON.parse(tabStr));
    }
    const mozURL = this._findMozURL(dt);
    if (!mozURL) {
      console.warn("Unknown drag-and-drop operation. Aborting.");
      return;
    }
    browser.tabs.create({
      url: mozURL,
      windowId: this.windowId
    });
    return;
  },
  handleDroppedTabCenterTab(e, tab) {
    let { tabId, origWindowId } = tab;
    let currentWindowId = this.windowId;
    if (currentWindowId != origWindowId) {
      browser.tabs.move(tabId, { windowId: currentWindowId, index: -1 });
      return;
    }

    let curTab = this.getTabById(tabId);

    if (e.target == this._spacerView || e.target == this._moreTabsView) {
      this.moveTabToBottom(curTab);
      return;
    }

    let dropTabId = SideTab.tabIdForEvent(e);

    if (tabId == dropTabId) {
      return;
    }

    let dropTab = this.getTabById(dropTabId);

    if (curTab.pinned != dropTab.pinned) { // They can't mix
      if (curTab.pinned) {
        // We tried to move a pinned tab to the non-pinned area, move it to the last
        // position of the pinned tabs.
        this.moveTabToBottom(curTab);
      } else {
        // Reverse of the previous statement
        this.moveTabToTop(curTab);
      }
      return;
    }

    let curTabPos = this.getPos(tabId);
    let dropTabPos = this.getPos(dropTabId);
    let newPos = curTabPos < dropTabPos ? Math.min(this.tabs.size, dropTabPos) :
    Math.max(0, dropTabPos);
    browser.tabs.move(tabId, { index: newPos });
  },
  onSpacerDblClick() {
    browser.tabs.create({});
  },
  onSpacerAuxClick(e) {
    if (e.which == 2) {
      browser.tabs.create({});
    }
  },
  onAnimationEnd(e) {
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this.getTabById(tabId);
    tab.onAnimationEnd(e);
  },
  async moveTabToBottom(tab) {
    let sameCategoryTabs = await browser.tabs.query({
      pinned: tab.pinned,
      windowId: this.windowId
    });
    let lastIndex = sameCategoryTabs[sameCategoryTabs.length - 1].index;
    await browser.tabs.move(tab.id, { index: lastIndex + 1 });
  },
  async moveTabToTop(tab) {
    let sameCategoryTabs = await browser.tabs.query({
      pinned: tab.pinned,
      windowId: this.windowId
    });
    let lastIndex = sameCategoryTabs[0].index;
    await browser.tabs.move(tab.id, { index: lastIndex });
  },
  clearSearch() {
    if (!this._filterActive) {
      return;
    }
    document.getElementById("searchbox-input").value = "";
    this.filter();
  },
  filter(query = "") {
    this._filterActive = query != "";
    query = normalizeStr(query);
    let notShown = 0;
    for (let tab of this.tabs.values()) {
      const show = normalizeStr(tab.url).includes(query) ||
                   normalizeStr(tab.title).includes(query);
      notShown += !show ? 1 : 0;
      tab.updateVisibility(show);
    }
    if (notShown > 0) {
      // Sadly browser.i18n doesn't support plurals, which is why we
      // only show a boring "Show all tabs…" message.
      this._moreTabsView.textContent = browser.i18n.getMessage("allTabsLabel");
      this._moreTabsView.setAttribute("hasMoreTabs", true);
    } else {
      this._moreTabsView.removeAttribute("hasMoreTabs");
    }
    this.maybeShrinkTabs();
  },
  async populate(windowId) {
    if (windowId && this.windowId === null) {
      this.windowId = windowId;
    }
    const tabs = await browser.tabs.query({windowId});
    // Sort the tabs by index so we can insert them in sequence.
    tabs.sort((a, b) => a.index - b.index);
    const pinnedFragment = document.createDocumentFragment();
    const unpinnedFragment = document.createDocumentFragment();
    for (let tab of tabs) {
      const sidetab = this._create(tab);
      let fragment = tab.pinned ? pinnedFragment : unpinnedFragment;
      fragment.appendChild(sidetab.view);
    }
    this.pinnedview.appendChild(pinnedFragment);
    this.view.appendChild(unpinnedFragment);
    this.maybeShrinkTabs();
    this.updateTabThumbnail(this.active);
    this.scrollToActiveTab();
  },
  checkWindow(tab) {
    return (tab.windowId == this.windowId);
  },
  getTab(tab) {
    if (this.checkWindow(tab)) {
      return this.getTabById(tab.id);
    }
    return null;
  },
  getTabById(tabId) {
    return this.tabs.get(tabId, null);
  },
  get compactPins() {
    return this._compactPins;
  },
  set compactPins(compact) {
    this._compactPins = compact;
    if (compact) {
      this.pinnedview.classList.add("compact");
    } else {
      this.pinnedview.classList.remove("compact");
    }
  },
  get tabsShrinked() {
    return this._tabsShrinked;
  },
  set tabsShrinked(shrinked) {
    this._tabsShrinked = shrinked;
    if (shrinked) {
      this._wrapperView.classList.add("shrinked");
    } else {
      this._wrapperView.classList.remove("shrinked");
    }
  },
  maybeShrinkTabs() {
    if (this.compactModeMode == COMPACT_MODE_STRICT ||
        this.compactModeMode == COMPACT_MODE_OFF) {
      this.tabsShrinked = this.compactModeMode == COMPACT_MODE_STRICT;
      return;
    }

    const spaceLeft = this._spacerView.offsetHeight;
    if (!this.tabsShrinked && spaceLeft == 0) {
      this.tabsShrinked = true;
      return;
    }
    if (this.tabsShrinked) {
      // Could we fit everything if we switched back to the "normal" mode?
      const wrapperHeight = this._wrapperView.offsetHeight;
      const estimatedTabHeight = 56; // Not very scientific, but it "mostly" works.

      // TODO: We are not accounting for the "More Tabs" element displayed when
      // filtering tabs.
      let allTabs = [...this.tabs.values()].filter(tab => tab.visible);
      let visibleTabs = allTabs.filter(tab => !tab.pinned);
      let pinnedTabs = allTabs.filter(tab => tab.pinned);
      let estimatedHeight = visibleTabs.length * estimatedTabHeight;
      if (this._compactPins) {
        estimatedHeight += pinnedTabs.length ? this.pinnedview.offsetHeight : 0;
      } else {
        estimatedHeight += pinnedTabs.length * estimatedTabHeight;
      }
      if (estimatedHeight <= wrapperHeight) {
        this.tabsShrinked = false;
      }
    }
  },
  _create(tabInfo) {
    let tab = new SideTab();
    this.tabs.set(tabInfo.id, tab);
    tab.init(tabInfo);
    if (tabInfo.active) {
      this.setActive(tab.id);
    }
    return tab;
  },
  create(tabInfo) {
    if (!this.checkWindow(tabInfo)) {
      return;
    }
    this.clearSearch();

    this._create(tabInfo);
    this.setPos(tabInfo.id, tabInfo.index);

    this.maybeShrinkTabs();
    if (tabInfo.active) {
      this.scrollToActiveTab();
    }
  },
  setActive(tabId) {
    let sidetab = this.getTabById(tabId);
    if (!sidetab) { // It's probably in another window
      return;
    }
    if (this.active) {
      this.getTabById(this.active).updateActive(false);
    }
    sidetab.updateActive(true);
    this.active = tabId;
  },
  updateThumbnail(tabId, thumbnail) {
    let sidetab = this.getTabById(tabId);
    if (sidetab) {
      sidetab.updateThumbnail(thumbnail);
    }
  },
  scrollToActiveTab() {
    if (!this.active) {
      return;
    }
    const sidetab = this.getTabById(this.active);
    if (sidetab) {
      sidetab.scrollIntoView();
    }
  },
  setTitle(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updateTitle(tab.title);
    }
  },
  setURL(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updateURL(tab.url);
    }
  },
  remove(tabId) {
    if (this.active == tabId) {
      this.active = null;
    }
    let sidetab = this.getTabById(tabId);
    if (!sidetab) {
      return;
    }
    sidetab.view.remove();
    this.tabs.delete(tabId);
    this.maybeShrinkTabs();
  },
  getPos(tabId) {
    let sidetab = this.getTabById(tabId);
    if (!sidetab) {
      return;
    }
    let orderedIds = [...SideTab.getAllTabsViews()].map(el => parseInt(SideTab.tabIdForView(el)));
    return orderedIds.indexOf(sidetab.id);
  },
  setPos(tabId, pos) {
    pos = parseInt(pos);
    let sidetab = this.getTabById(tabId);
    if (!sidetab) {
      return;
    }
    let element = sidetab.view;
    let parent = sidetab.pinned ? this.pinnedview : this.view;
    let elements = SideTab.getAllTabsViews();
    // Can happen with browser.tabs.closeWindowWithLastTab set to true or during
    // session restore.
    if (!elements.length) {
      parent.appendChild(element);
      return;
    }
    let nextSibling = elements[pos];
    if (!nextSibling || (nextSibling.parentElement !== parent)) {
      nextSibling = elements[pos-1].nextSibling;
    }
    parent.insertBefore(element, nextSibling);
  },
  setAudible(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updateAudible(tab.audible);
    }
  },
  setMuted(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updatedMuted(tab.mutedInfo.muted);
    }
  },
  setIcon(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      if (tab.favIconUrl) {
        sidetab.updateIcon(tab.favIconUrl);
      } else {
        sidetab.resetIcon();
      }
    }
  },
  setLoading(tab, isLoading) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.setLoading(isLoading);
    }
  },
  setPinned(tab) {
    let sidetab = this.getTab(tab);
    if (!sidetab) {
      return;
    }
    sidetab.updatePinned(tab.pinned);
    if (tab.pinned && this._compactPins) {
      sidetab.resetThumbnail();
    }
    let newView = tab.pinned ? this.pinnedview : this.view;
    newView.appendChild(sidetab.view);
    this.setPos(tab.id, tab.index);
    this.maybeShrinkTabs();
  },
  setDiscarded(tab) {
    let sidetab = this.getTab(tab);
    if (!sidetab) {
      return;
    }
    sidetab.updateDiscarded(tab.discarded);
  },
  setContext(tab, context) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updateContext(context);
    }
  },
  _resizeBase64Image(b64) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const height = 192;
        const width = Math.floor(img.width * 192 / img.height);
        this._resizeCanvas.width = width;
        this._resizeCanvas.height = height;
        this._resizeCanvasCtx.drawImage(img, 0, 0, width, height);
        resolve(this._resizeCanvas.toDataURL());
      };
      img.src = b64;
    });
  },
  async updateTabThumbnail(tabId) {
    if (this.compactModeMode == COMPACT_MODE_STRICT) {
      return;
    }
    // TODO: sadly we can only capture a thumbnail of the current tab. bug 1246693
    if (this.active != tabId) {
      return;
    }
    let sidetab = this.getTabById(tabId);
    if (!sidetab || (sidetab.pinned && this._compactPins)) {
      return;
    }
    const thumbnailBase64 = await browser.tabs.captureVisibleTab(this.windowId, {
      format: "png"
    });
    const resizedBase64 = await this._resizeBase64Image(thumbnailBase64);
    this.updateThumbnail(tabId, resizedBase64);
  }
};

// Remove case and accents/diacritics.
function normalizeStr(str) {
  return str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
}

module.exports = SideTabList;
