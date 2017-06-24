const SideTab = require("./tab.js");
const ContextMenu = require("./contextmenu.js");

function SideTabList() {
  this.tabs = new Map();
  this.active = null;
  this.alwaysShrink = false;
  this._tabsShrinked = false;
  this.windowId = null;
  this.view = document.getElementById("tablist");
  this.pinnedCount = 0;
  this.pinnedStyle = null;
}

SideTabList.prototype = {
  async init() {
    this.alwaysShrink = (await browser.storage.local.get({
      alwaysShrink: false
    })).alwaysShrink;
    if (this.alwaysShrink) {
      this.maybeShrinkTabs();
    }
    const pinTabs = (await browser.storage.local.get({
      pinTabs: false
    })).pinTabs;
    this.togglePinTabs(pinTabs);
    this.setupListeners();
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
      this.create(tab);
    });
    browser.tabs.onDetached.addListener(tabId => this.remove(tabId));

    // Global ("event-bubbling") listeners
    // Because defining event listeners for each tab is a terrible idea.
    // Read more here: https://davidwalsh.name/event-delegate
    this.view.addEventListener("click", e => this.onClick(e));
    this.view.addEventListener("mousedown", e => this.onMouseDown(e));
    this.view.addEventListener("contextmenu", e => this.onContextMenu(e));
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
    window.addEventListener("resize", () => {
      this.updatePinnedStyle();
    });

    this._spacerView.addEventListener("dblclick", () => this.onSpacerDblClick());
    this._moreTabsView.addEventListener("click", () => this.clearSearch());

    // Drag-and-drop
    document.addEventListener("dragstart", e => this.onDragStart(e));
    document.addEventListener("dragover", e => this.onDragOver(e));
    document.addEventListener("drop", e => this.onDrop(e));

    // Pref changes
    browser.storage.onChanged.addListener(changes => {
      if (changes.alwaysShrink) {
        this.alwaysShrink = changes.alwaysShrink.newValue;
        this.maybeShrinkTabs();
      }
      if (changes.pinTabs) {
        this.togglePinTabs(changes.pinTabs.newValue);
      }
    });
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
    if (changeInfo.hasOwnProperty("url")) {
      this.updateTabThumbnail(tabId);
      this.setURL(tab);
    }
    if (changeInfo.hasOwnProperty("mutedInfo")) {
      this.setMuted(tab);
    }
    if (changeInfo.hasOwnProperty("audible")) {
      this.setAudible(tab);
    }
    if (changeInfo.status === "loading") {
      this.updateTabThumbnail(tabId);
      this.setSpinner(tab);
    }
    if (changeInfo.status === "complete") {
      this.updateTabThumbnail(tabId);
      this.setIcon(tab);
    }
    if (changeInfo.hasOwnProperty("pinned")) {
      this.updatePinnedCount(changeInfo.pinned ? 1 : -1);
      this.setPinned(tab);
    }
  },
  onMouseDown(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (!e.target) {
      return;
    }

    if (e.which == 1 && SideTab.isTabEvent(e)) {
      browser.tabs.update(SideTab.tabIdForEvent(e), {active: true});
      return;
    }
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
    if (!e.target || !SideTab.isTabEvent(e, false)) {
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
      label: browser.i18n.getMessage("contextMenuMoveTabToNewWindow"),
      onCommandFn: () => {
        browser.windows.create({ tabId });
      }
    });
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
      label: browser.i18n.getMessage("contextMenuCloseTab"),
      onCommandFn: () => {
        browser.tabs.remove(tabId);
      }
    });
    return items;
  },
  onClick(e) {
    if (!e.target) {
      return;
    }

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
    if (!e.target || !SideTab.isTabEvent(e)) {
      return;
    }
    e.dataTransfer.setData("text/x-tabcenter-tab", JSON.stringify({
      tabId: parseInt(SideTab.tabIdForEvent(e)),
      origWindowId: this.windowId
    }));
    e.dataTransfer.dropEffect = "move";
  },
  onDragOver(e) {
    e.preventDefault();
  },
  onDrop(e) {
    if (!e.target || (!SideTab.isTabEvent(e, false) &&
                      e.target != this._spacerView &&
                      e.target != this._moreTabsView)) {
      return;
    }
    e.preventDefault();

    const dt = e.dataTransfer;
    const linkURL = dt.getData("text/x-moz-url-data"); // dragged link
    if (linkURL) {
      browser.tabs.create({
        url: linkURL,
        windowId: this.windowId
      });
      return;
    }
    const tabStr = dt.getData("text/x-tabcenter-tab");
    if (!tabStr) {
      console.warn("Unknown drag-and-drop operation. Aborting.");
      return;
    }
    let { tabId, origWindowId } = JSON.parse(tabStr);
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
  async moveTabToBottom(tab) {
    let sameCategoryTabs = await browser.tabs.query({
      pinned: tab.pinned
    });
    let lastIndex = sameCategoryTabs[sameCategoryTabs.length - 1].index;
    await browser.tabs.move(tab.id, { index: lastIndex + 1 });
  },
  async moveTabToTop(tab) {
    let sameCategoryTabs = await browser.tabs.query({
      pinned: tab.pinned
    });
    let lastIndex = sameCategoryTabs[0].index;
    await browser.tabs.move(tab.id, { index: lastIndex });
  },
  clearSearch() {
    document.getElementById("searchbox-input").value = "";
    this.filter();
  },
  filter(query = "") {
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
    const fragment = document.createDocumentFragment();
    for (let tab of tabs) {
      const sidetab = this._create(tab);
      fragment.appendChild(sidetab.view);
    }
    this.view.appendChild(fragment);
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
  get tabsShrinked() {
    return this._tabsShrinked;
  },
  set tabsShrinked(shrinked) {
    this._tabsShrinked = shrinked;
    if (shrinked) {
      this.view.classList.add("shrinked");
    } else {
      this.view.classList.remove("shrinked");
    }
  },
  maybeShrinkTabs() {
    if (this.alwaysShrink) {
      this.tabsShrinked = true;
      return;
    }

    const spaceLeft = this._spacerView.offsetHeight;
    if (!this.tabsShrinked && spaceLeft == 0) {
      this.tabsShrinked = true;
      return;
    }
    if (this.tabsShrinked) {
      // Could we fit everything if we switched back to the "normal" mode?
      const wrapperHeight = document.getElementById("tablist-wrapper").offsetHeight;
      const estimatedTabHeight = 56; // Not very scientific, but it "mostly" works.

      // TODO: We are not accounting for the "More Tabs" element displayed when
      // filtering tabs.
      let visibleTabs = [...this.tabs.values()].filter(tab => tab.visible);
      if (visibleTabs.length * estimatedTabHeight <= wrapperHeight) {
        this.tabsShrinked = false;
      }
    }
  },
  togglePinTabs(pinTabs) {
    if (pinTabs) {
      this.view.parentElement.classList.add("pin-tabs");
    } else {
      this.view.parentElement.classList.remove("pin-tabs");
    }
  },
  _create(tabInfo) {
    let tab = new SideTab();
    this.tabs.set(tabInfo.id, tab);
    tab.create(tabInfo);
    this.updatePinnedCount(tabInfo.pinned ? 1 : 0);
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
    this.updatePinnedCount(sidetab.pinned ? -1 : 0);
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
    let elements = SideTab.getAllTabsViews();
    if (!elements[pos]) {
      this.view.insertBefore(element, elements[pos-1].nextSibling);
    } else {
      this.view.insertBefore(element, elements[pos]);
    }
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
      sidetab.updateIcon(tab.favIconUrl);
    }
  },
  setSpinner(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.setSpinner();
    }
  },
  setPinned(tab) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updatePinned(tab.pinned);
    }
  },
  setContext(tab, context) {
    let sidetab = this.getTab(tab);
    if (sidetab) {
      sidetab.updateContext(context);
    }
  },
  async updateTabThumbnail(tabId) {
    if (this.alwaysShrink) {
      return;
    }
    // TODO: sadly we can only capture a thumbnail of the current tab. bug 1246693
    if (this.active != tabId) {
      return;
    }
    let thumbnail = await browser.tabs.captureVisibleTab(this.windowId, {
      format: "png"
    });
    this.updateThumbnail(tabId, thumbnail);
  },
  updatePinnedCount(change) {
    this.pinnedCount += change;
    this.updatePinnedStyle();
  },
  updatePinnedStyle() {
    const tabWidth = 32;
    const tabHeight = 35;
    const columns = Math.floor(window.innerWidth / tabWidth);
    const rows = Math.ceil(this.pinnedCount / columns);
    const offset = rows * tabHeight;

    const style = document.createElement("style");
    document.head.appendChild(style);
    style.sheet.insertRule(`
      .pin-tabs {
        padding-top: ${offset}px;
      }
    `);
    style.sheet.insertRule(`
      .pin-tabs .tab.pinned {
        margin-top: -${offset}px;
      }
    `);
    if (this.pinnedStyle) {
      this.pinnedStyle.remove();
    }
    this.pinnedStyle = style;
  }
};

// Remove case and accents/diacritics.
function normalizeStr(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

module.exports = SideTabList;
