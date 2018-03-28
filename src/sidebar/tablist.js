import SideTab from "./tab.js";
import TabContextMenu from "./tabcontextmenu.js";

const COMPACT_MODE_OFF = 0;
/*const COMPACT_MODE_DYNAMIC = 1;*/
const COMPACT_MODE_STRICT = 2;

/* @arg {props}
 * openTab
 * search
 * prefs
 */
function TabList(props) {
  this._props = props;
  this._tabs = new Map();
  this._active = null;
  this.__compactPins = true;
  this.__tabsShrinked = false;
  this._windowId = null;
  this._filterActive = false;
  this._view = document.getElementById("tablist");
  this._pinnedview = document.getElementById("pinnedtablist");
  this._wrapperView = document.getElementById("tablist-wrapper");
  this._spacerView = document.getElementById("spacer");
  this._moreTabsView = document.getElementById("moretabs");

  this._compactModeMode = parseInt(this._props.prefs.compactModeMode);
  this._compactPins = this._props.prefs.compactPins;
  this._setupListeners();
}

TabList.prototype = {
  _setupListeners() {
    // Tab events
    browser.tabs.onActivated.addListener(({tabId}) => this._onBrowserTabActivated(tabId));
    browser.tabs.onCreated.addListener(tab => this._create(tab));
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
                                       this._onBrowserTabUpdated(tabId, changeInfo, tab));
    browser.tabs.onRemoved.addListener(tabId => this._remove(tabId));
    browser.tabs.onMoved.addListener((tabId, moveInfo) => this._onBrowserTabMoved(tabId, moveInfo));
    browser.tabs.onAttached.addListener(async tabId => {
      let tab = await browser.tabs.get(tabId);
      tab.id = tabId; // Replace the ID by the new tab ID (they are different!).
      this._create(tab);
    });
    browser.tabs.onDetached.addListener(tabId => this._remove(tabId));

    // Global ("event-bubbling") listeners
    // Because defining event listeners for each tab is a terrible idea.
    // Read more here: https://davidwalsh.name/event-delegate
    for (let view of [this._view, this._pinnedview]) {
      view.addEventListener("click", e => this._onClick(e));
      view.addEventListener("auxclick", e => this._onAuxClick(e));
      view.addEventListener("mousedown", e => this._onMouseDown(e));
      view.addEventListener("contextmenu", e => this._onContextMenu(e));
      view.addEventListener("animationend", e => this._onAnimationEnd(e));
    }

    this._spacerView.addEventListener("dblclick", () => this._onSpacerDblClick());
    this._spacerView.addEventListener("auxclick", e => this._onSpacerAuxClick(e));
    this._moreTabsView.addEventListener("click", () => this._clearSearch());
    this._view.addEventListener("scroll", () => this.onScroll());

    // Drag-and-drop
    document.addEventListener("dragstart", e => this._onDragStart(e));
    document.addEventListener("dragover", e => this._onDragOver(e));
    document.addEventListener("drop", e => this._onDrop(e));

    // Pref changes
    browser.storage.onChanged.addListener(changes => this._onPrefsChanged(changes));
  },
  _onPrefsChanged(changes) {
    if (changes.compactModeMode) {
      this._compactModeMode = parseInt(changes.compactModeMode.newValue);
    }
    if (changes.compactPins) {
      this._compactPins = changes.compactPins.newValue;
    }
    this._maybeShrinkTabs();
  },
  _onBrowserTabActivated(tabId) {
    this._setActive(tabId);
    this._maybeUpdateTabThumbnail(tabId);
    this._scrollToTab(tabId);
  },
  _onBrowserTabMoved(tabId, moveInfo) {
    this._setPos(tabId, moveInfo.fromIndex < moveInfo.toIndex ?
                       moveInfo.toIndex + 1: moveInfo.toIndex
    );
    this._scrollToTab(tabId);
  },
  _onBrowserTabUpdated(tabId, changeInfo, tab) {
    const sidetab = this._getTab(tab);
    if (!sidetab) {
      return; // Tab not in the current window or destroyed.
    }
    sidetab.onUpdate(changeInfo);

    if (changeInfo.hasOwnProperty("pinned")) {
      this._onTabPinned(sidetab, tab);
    }
  },
  _onMouseDown(e) {
    // Don't put preventDefault here or drag-and-drop won't work
    if (e.button === 0 && SideTab.isTabEvent(e)) {
      browser.tabs.update(SideTab.tabIdForEvent(e), {active: true});
      return;
    }
    // Prevent autoscrolling on middle click
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
  },
  _onAuxClick(e) {
    if (e.button === 1 && SideTab.isTabEvent(e, false)) {
      browser.tabs.remove(SideTab.tabIdForEvent(e));
      e.preventDefault();
      return;
    }
  },
  _closeContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.close();
    }
  },
  _onContextMenuHidden() {
    this._contextMenu = null;
  },
  _onContextMenu(e) {
    this._closeContextMenu();
    e.preventDefault();
    if (!SideTab.isTabEvent(e, false)) {
      return;
    }
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this._getTabById(tabId);
    this._contextMenu = new TabContextMenu({
      tab,
      posX: e.clientX, posY: e.clientY,
      onClose: this._onContextMenuHidden.bind(this),
      canMoveToNewWindow: this._tabs.size > 1,
      reloadAllTabs: this._reloadAllTabs.bind(this),
      closeTabsUnderneath: this._closeTabsUnderneath.bind(this, tabId),
      closeOtherTabs: this._closeAllTabsExcept.bind(this, tabId),
      canUndoCloseTab: this._hasRecentlyClosedTabs.bind(this),
      undoCloseTab: this._undoCloseTab.bind(this)
    });
    this._contextMenu.show();
  },
  _closeTabsUnderneath(tabId) {
    const tabPos = this._getPos(tabId);
    const orderedIds = [...SideTab.getAllTabsViews()].map(el => SideTab.tabIdForView(el));
    const toClose = orderedIds.slice(tabPos + 1).filter(id => this._tabs.get(id).visible);
    browser.tabs.remove(toClose);
  },
  _closeAllTabsExcept(tabId) {
    const toClose = [...this._tabs.values()]
                    .filter(tab => tab.id !== tabId && !tab.pinned)
                    .map(tab => tab.id);
    browser.tabs.remove(toClose);
  },
  _reloadAllTabs() {
    for (let tab of this._tabs.values()) {
      browser.tabs.reload(tab.id);
    }
  },
  async _hasRecentlyClosedTabs() {
    const undoTabs = await this._getRecentlyClosedTabs();
    return !!undoTabs.length;
  },
  async _getRecentlyClosedTabs() {
    const sessions = await browser.sessions.getRecentlyClosed();
    return sessions.map(s => s.tab)
                   .filter(s => s && this._checkWindow(s));
  },
  async _undoCloseTab() {
    const undoTabs = await this._getRecentlyClosedTabs();
    if (undoTabs.length) {
      browser.sessions.restore(undoTabs[0].sessionId);
    }
  },
  onScroll() {
    if (this._view.scrollTop === 0) {
      this._wrapperView.classList.remove("scrolled");
    } else {
      this._wrapperView.classList.add("scrolled");
    }
  },
  _onClick(e) {
    if (SideTab.isCloseButtonEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      browser.tabs.remove(tabId);
    } else if (SideTab.isIconOverlayEvent(e)) {
      const tabId = SideTab.tabIdForEvent(e);
      const tab = this._getTabById(tabId);
      browser.tabs.update(tabId, {"muted": !tab.muted});
    }
  },
  _onDragStart(e) {
    if (!SideTab.isTabEvent(e)) {
      return;
    }
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this._getTabById(tabId);
    e.dataTransfer.setData("text/x-tabcenter-tab", JSON.stringify({
      tabId: parseInt(SideTab.tabIdForEvent(e)),
      origWindowId: this._windowId
    }));
    e.dataTransfer.setData("text/x-moz-place", JSON.stringify({
      type: "text/x-moz-place",
      title: tab.title,
      uri: tab.url
    }));
    e.dataTransfer.dropEffect = "move";
  },
  _onDragOver(e) {
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
  _onDrop(e) {
    if (!SideTab.isTabEvent(e, false) &&
        e.target !== this._spacerView &&
        e.target !== this._moreTabsView) {
      return;
    }
    e.preventDefault();

    const dt = e.dataTransfer;
    const tabStr = dt.getData("text/x-tabcenter-tab");
    if (tabStr) {
      return this._handleDroppedTabCenterTab(e, JSON.parse(tabStr));
    }
    const mozURL = this._findMozURL(dt);
    if (!mozURL) {
      console.warn("Unknown drag-and-drop operation. Aborting.");
      return;
    }
    this._props.openTab({
      url: mozURL,
      windowId: this._windowId
    });
    return;
  },
  _handleDroppedTabCenterTab(e, tab) {
    let {tabId, origWindowId} = tab;
    let currentWindowId = this._windowId;
    if (currentWindowId !== origWindowId) {
      browser.tabs.move(tabId, {windowId: currentWindowId, index: -1});
      return;
    }

    let curTab = this._getTabById(tabId);

    if (e.target === this._spacerView || e.target === this._moreTabsView) {
      this._moveTabToBottom(curTab);
      return;
    }

    let dropTabId = SideTab.tabIdForEvent(e);

    if (tabId === dropTabId) {
      return;
    }

    let dropTab = this._getTabById(dropTabId);

    if (curTab.pinned !== dropTab.pinned) { // They can't mix
      if (curTab.pinned) {
        // We tried to move a pinned tab to the non-pinned area, move it to the last
        // position of the pinned tabs.
        this._moveTabToBottom(curTab);
      } else {
        // Reverse of the previous statement
        this._moveTabToTop(curTab);
      }
      return;
    }

    let curTabPos = this._getPos(tabId);
    let dropTabPos = this._getPos(dropTabId);
    let newPos = curTabPos < dropTabPos ? Math.min(this._tabs.size, dropTabPos) :
    Math.max(0, dropTabPos);
    browser.tabs.move(tabId, {index: newPos});
  },
  _onSpacerDblClick() {
    this._props.openTab();
  },
  _onSpacerAuxClick(e) {
    if (e.button === 1) {
      this._props.openTab();
    }
  },
  _onAnimationEnd(e) {
    const tabId = SideTab.tabIdForEvent(e);
    const tab = this._getTabById(tabId);
    tab.onAnimationEnd(e);
  },
  async _moveTabToBottom(tab) {
    let sameCategoryTabs = await browser.tabs.query({
      pinned: tab.pinned,
      windowId: this._windowId
    });
    let lastIndex = sameCategoryTabs[sameCategoryTabs.length - 1].index;
    await browser.tabs.move(tab.id, {index: lastIndex + 1});
  },
  async _moveTabToTop(tab) {
    let sameCategoryTabs = await browser.tabs.query({
      pinned: tab.pinned,
      windowId: this._windowId
    });
    let lastIndex = sameCategoryTabs[0].index;
    await browser.tabs.move(tab.id, {index: lastIndex});
  },
  _clearSearch() {
    // _clearSearch() is called every time we open a new tab (see _create()),
    // which subsequently calls the expensive filter() method.
    // _filterActive provides a fast-path for the common-case where there is
    // no search going on.
    if (!this._filterActive) {
      return;
    }
    this._props.search("");
  },
  filter(query) {
    this._filterActive = query.length > 0;
    query = normalizeStr(query);
    let notShown = 0;
    for (let tab of this._tabs.values()) {
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
    this._maybeShrinkTabs();
  },
  async populate(windowId) {
    if (windowId && this._windowId === null) {
      this._windowId = windowId;
    }
    const tabs = await browser.tabs.query({windowId});
    // Sort the tabs by index so we can insert them in sequence.
    tabs.sort((a, b) => a.index - b.index);
    const pinnedFragment = document.createDocumentFragment();
    const unpinnedFragment = document.createDocumentFragment();
    for (let tab of tabs) {
      const sidetab = this.__create(tab);
      let fragment = tab.pinned ? pinnedFragment : unpinnedFragment;
      fragment.appendChild(sidetab.view);
    }
    this._pinnedview.appendChild(pinnedFragment);
    this._view.appendChild(unpinnedFragment);
    this._maybeShrinkTabs();
    this._maybeUpdateTabThumbnail(this._active);
    this._scrollToTab(this._active);
  },
  _checkWindow(tab) {
    return (tab.windowId === this._windowId);
  },
  _getTab(tab) {
    if (this._checkWindow(tab)) {
      return this._getTabById(tab.id);
    }
    return null;
  },
  _getTabById(tabId) {
    return this._tabs.get(tabId, null);
  },
  get _compactPins() {
    return this.__compactPins;
  },
  set _compactPins(compact) {
    this.__compactPins = compact;
    if (compact) {
      this._pinnedview.classList.add("compact");
    } else {
      this._pinnedview.classList.remove("compact");
    }
  },
  get _tabsShrinked() {
    return this.__tabsShrinked;
  },
  set _tabsShrinked(shrinked) {
    this.__tabsShrinked = shrinked;
    if (shrinked) {
      this._wrapperView.classList.add("shrinked");
    } else {
      this._wrapperView.classList.remove("shrinked");
    }
  },
  _maybeShrinkTabs() {
    // Avoid an expensive sync reflow (offsetHeight).
    requestAnimationFrame(() => {
      this.__maybeShrinkTabs();
    });
  },
  __maybeShrinkTabs() {
    if (this._compactModeMode === COMPACT_MODE_STRICT ||
        this._compactModeMode === COMPACT_MODE_OFF) {
      this._tabsShrinked = this._compactModeMode === COMPACT_MODE_STRICT;
      return;
    }

    const spaceLeft = this._spacerView.offsetHeight;
    if (!this._tabsShrinked && spaceLeft === 0) {
      this._tabsShrinked = true;
      return;
    }
    if (!this._tabsShrinked) {
      return;
    }
    // Could we fit everything if we switched back to the "normal" mode?
    const wrapperHeight = this._wrapperView.offsetHeight;
    const estimatedTabHeight = 56; // Not very scientific, but it "mostly" works.

    // TODO: We are not accounting for the "More Tabs" element displayed when
    // filtering tabs.
    let allTabs = [...this._tabs.values()].filter(tab => tab.visible);
    let visibleTabs = allTabs.filter(tab => !tab.pinned);
    let pinnedTabs = allTabs.filter(tab => tab.pinned);
    let estimatedHeight = visibleTabs.length * estimatedTabHeight;
    if (this._compactPins) {
      estimatedHeight += pinnedTabs.length ? this._pinnedview.offsetHeight : 0;
    } else {
      estimatedHeight += pinnedTabs.length * estimatedTabHeight;
    }
    if (estimatedHeight <= wrapperHeight) {
      this._tabsShrinked = false;
    }
  },
  __create(tabInfo) {
    let tab = new SideTab();
    this._tabs.set(tabInfo.id, tab);
    tab.init(tabInfo);
    if (tabInfo.active) {
      this._setActive(tab.id);
    }
    return tab;
  },
  _create(tabInfo) {
    if (!this._checkWindow(tabInfo)) {
      return;
    }
    this._clearSearch();

    this.__create(tabInfo);
    this._setPos(tabInfo.id, tabInfo.index);

    this._maybeShrinkTabs();
    this._scrollToTab(tabInfo.id);
  },
  _setActive(tabId) {
    let sidetab = this._getTabById(tabId);
    if (!sidetab) { // It's probably in another window
      return;
    }
    if (this._active) {
      this._getTabById(this._active).updateActive(false);
    }
    sidetab.updateActive(true);
    this._active = tabId;
  },
  _scrollToTab(tabId) {
    const sidetab = this._getTabById(tabId);
    if (sidetab) {
      sidetab.scrollIntoView();
    }
  },
  _remove(tabId) {
    if (this._active === tabId) {
      this._active = null;
    }
    let sidetab = this._getTabById(tabId);
    if (!sidetab) {
      return;
    }
    sidetab.view.remove();
    this._tabs.delete(tabId);
    this._maybeShrinkTabs();
  },
  _getPos(tabId) {
    let sidetab = this._getTabById(tabId);
    if (!sidetab) {
      return;
    }
    let orderedIds = [...SideTab.getAllTabsViews()].map(el => SideTab.tabIdForView(el));
    return orderedIds.indexOf(sidetab.id);
  },
  _setPos(tabId, pos) {
    pos = parseInt(pos);
    let sidetab = this._getTabById(tabId);
    if (!sidetab) {
      return;
    }
    let element = sidetab.view;
    let parent = sidetab.pinned ? this._pinnedview : this._view;
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
  _onTabPinned(sidetab, tab) {
    if (tab.pinned && this._compactPins) {
      sidetab.resetThumbnail();
    }
    let newView = tab.pinned ? this._pinnedview : this._view;
    newView.appendChild(sidetab.view);
    this._setPos(tab.id, tab.index);
    this._maybeShrinkTabs();
  },
  _maybeUpdateTabThumbnail(tabId) {
    if (this._compactModeMode === COMPACT_MODE_STRICT) {
      return;
    }
    let sidetab = this._getTabById(tabId);
    if (!sidetab || (sidetab.pinned && this._compactPins)) {
      return;
    }
    sidetab.updateThumbnail();
  }
};

// Remove case and accents/diacritics.
function normalizeStr(str) {
  return str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
}

export default TabList;
