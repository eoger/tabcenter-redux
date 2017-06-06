const SideTab = require("./tab.js");

function SideTabList() {
  this.tabs = new Map();
  this.active = null;
  this._tabsShrinked = false;
  this.windowId = null;
  this.view = document.getElementById("tablist");
  this.setupListeners();
}

SideTabList.prototype = {
  setupListeners() {
    this._spacerView = document.getElementById("spacer");
    const moreTabs = document.getElementById("moretabs");

    // Tab events
    browser.tabs.onActivated.addListener(({tabId}) => this.setActive(tabId));
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

    this._spacerView.addEventListener("dblclick", () => this.onSpacerDblClick());
    moreTabs.addEventListener("click", () => this.clearSearch());

    // Drag-and-drop
    document.addEventListener("dragstart", e => this.onDragStart(e));
    document.addEventListener("dragover", e => this.onDragOver(e));
    document.addEventListener("drop", e => this.onDrop(e));
  },
  onBrowserTabMoved(tabId, moveInfo) {
    this.setPos(tabId, moveInfo.fromIndex < moveInfo.toIndex ?
                       moveInfo.toIndex + 1: moveInfo.toIndex
    );
  },
  onBrowserTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.hasOwnProperty("title")) {
      this.setTitle(tab);
    }
    if (changeInfo.hasOwnProperty("url")) {
      // TODO: if the tab updating is not the active one, this will have
      // the effect of updating the active tab thumbnail, but whatever.
      this.updateCurrentTabThumbnail();
      this.setURL(tab);
    }
    if (changeInfo.hasOwnProperty("mutedInfo")) {
      this.setMuted(tab);
    }
    if (changeInfo.hasOwnProperty("audible")) {
      this.setAudible(tab);
    }
    if (changeInfo.status === "loading") {
      this.updateCurrentTabThumbnail();
      this.setSpinner(tab);
    }
    if (changeInfo.status === "complete") {
      this.updateCurrentTabThumbnail();
      this.setIcon(tab);
    }
    if (changeInfo.hasOwnProperty("pinned")) {
      this.setPinned(tab);
    }
  },
  getTabIdForEvent(e) {
    let el = e.target;
    while (!el.getAttribute("data-tab-id") && (el = el.parentElement));
    return parseInt(el.getAttribute("data-tab-id"));
  },
  onMouseDown(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (!e.target) {
      return;
    }

    if (e.which == 1 && e.target.classList.contains("tab")) {
      const tabId = this.getTabIdForEvent(e);
      browser.tabs.update(tabId, {active: true});
    }
  },
  onClick(e) {
    e.stopPropagation();
    if (!e.target) {
      return;
    }

    // TODO: Not a big fan of className-testing here here,
    //       which exposes the internal implementation of a tab.
    if (e.target.classList.contains("tab-close")) {
      const tabId = this.getTabIdForEvent(e);
      browser.tabs.remove(tabId);
    } else if (e.target.classList.contains("tab-icon-overlay")) {
      const tabId = this.getTabIdForEvent(e);
      let tab = this.getTabById(tabId);
      browser.tabs.update(tabId, {"muted": !tab.muted});
    }
  },
  onDragStart(e) {
    if (!e.target || !e.target.classList.contains("tab")) {
      return;
    }
    e.dataTransfer.setData("text/plain", JSON.stringify({
      tabId: parseInt(e.target.getAttribute("data-tab-id")),
      origWindowId: this.windowId
    }));
    e.dataTransfer.dropEffect = "move";
  },
  onDragOver(e) {
    e.preventDefault();
  },
  onDrop(e) {
    if (!e.target || (!e.target.classList.contains("tab") &&
                      e.target.id != "spacer" &&
                      e.target.id != "moretabs")) {
      return;
    }
    e.preventDefault();
    let { tabId, origWindowId } = JSON.parse(e.dataTransfer.getData("text"));
    let currentWindowId = this.windowId;
    if (currentWindowId != origWindowId) {
      browser.tabs.move(tabId, { windowId: currentWindowId, index: -1 });
      return;
    }

    let curTab = this.getTabById(tabId);

    if (e.target.id == "spacer" || e.target.id == "moretabs") {
      this.moveTabToBottom(curTab);
      return;
    }

    let dropTabId = this.getTabIdForEvent(e);

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
    let notShown = 0;
    for (let tab of this.tabs.values()) {
      const show = tab.url.includes(query) || tab.title.includes(query);
      notShown += !show ? 1 : 0;
      tab.updateVisibility(show);
    }
    let moreTabs = document.getElementById("moretabs");
    if (notShown > 0) {
      moreTabs.textContent = `${notShown} more tab(s)…`;
      moreTabs.setAttribute("hasMoreTabs", true);
    } else {
      moreTabs.removeAttribute("hasMoreTabs");
    }
    this.maybeShrinkTabs();
  },
  async populate(windowId) {
    if (windowId && this.windowId === null) {
      this.windowId = windowId;
    }
    const tabs = await browser.tabs.query({currentWindow: true});
    for (let tab of tabs) {
      this.create(tab);
    }
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
  create(tab) {
    if (!this.checkWindow(tab)) {
      return;
    }
    this.clearSearch();

    // TODO: Merge constructor and create() maybe?
    let sidetab = new SideTab();
    sidetab.create(tab);
    this.view.appendChild(sidetab.view);
    this.tabs.set(tab.id, sidetab);

    // TODO: the stuff bellow seems rather ineficient and will cause reflows.
    // We should be setting the right state directly in create()
    this.setPos(tab.id, tab.index);
    if (tab.active) {
      this.setActive(tab.id);
    }
    this.setTitle(tab);
    this.setURL(tab);
    this.setMuted(tab);
    this.setAudible(tab);
    this.setIcon(tab);
    this.setPinned(tab);
    if (tab.cookieStoreId) {
      browser.contextualIdentities.get(tab.cookieStoreId).then((context) => {
        this.setContext(tab, context);
      });
    }
    // TODO: This probably means that for a tab-bulk insert (like in _populate),
    // This will be called multiple times for nothing and cause reflows.
    this.maybeShrinkTabs();
  },
  setActive(tabId) {
    let sidetab = this.getTabById(tabId);
    if (sidetab) {
      if (this.active) {
        this.getTabById(this.active).updateActive(false);
      }
      sidetab.updateActive(true);
      this.active = tabId;
    }
    this.updateCurrentTabThumbnail();
  },
  updateThumbnail(tabId, thumbnail) {
    let sidetab = this.getTabById(tabId);
    if (sidetab) {
      sidetab.updateThumbnail(thumbnail);
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
    let sidetab = this.getTabById(tabId);
    if (this.active == tabId) {
      this.active = null;
    }
    if (sidetab) {
      sidetab.view.remove();
      this.tabs.delete(tabId);
    }
    this.maybeShrinkTabs();
  },
  getTabsViews() {
    return this.view.getElementsByClassName("tab");
  },
  getPos(tabId) {
    let sidetab = this.getTabById(tabId);
    if (!sidetab) {
      return;
    }
    let orderedIds = [...this.getTabsViews()].map(el => parseInt(el.getAttribute("data-tab-id")));
    return orderedIds.indexOf(sidetab.id);
  },
  setPos(tabId, pos) {
    pos = parseInt(pos);
    let sidetab = this.getTabById(tabId);
    if (!sidetab) {
      return;
    }
    let element = sidetab.view;
    let elements = this.getTabsViews();
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
      if (tab.favIconUrl) {
        sidetab.setIcon(tab.favIconUrl);
      } else {
        sidetab.resetIcon();
      }
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
  async updateCurrentTabThumbnail() {
    // TODO: sadly we can only capture a thumbnail of the current tab. bug 1246693
    let currentTabId = this.active;
    let thumbnail = await browser.tabs.captureVisibleTab(null, {
      format: "png"
    });
    this.updateThumbnail(currentTabId, thumbnail);
  }
};

module.exports = SideTabList;
