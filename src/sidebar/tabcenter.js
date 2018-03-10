const TabList = require("./tablist");
const TopMenu = require("./topmenu");

function TabCenter() {
}
TabCenter.prototype = {
  async init() {
    const search = this._search.bind(this);
    const openTab = this._openTab.bind(this);
    this._topMenu = new TopMenu({openTab, search});
    // Do other work while the promises are pending.
    const prefsPromise = this._readPrefs();
    const windowPromise = browser.windows.getCurrent();

    this._setupListeners();

    const prefs = await prefsPromise;
    this._applyPrefs(prefs);
    this._tabList = new TabList({openTab, search, prefs});
    const {id: windowId} = await windowPromise;
    this._windowId = windowId;
    // There's no real need to await on populate().
    this._tabList.populate(windowId);

    browser.runtime.sendMessage({
      event: "sidebar-open",
      windowId
    });

    browser.runtime.getPlatformInfo().then((platform) => {
      document.body.setAttribute("platform", platform.os);
    });
  },
  async _openTab(props = {}) {
    if (props.afterCurrent) {
      let currentIndex = (await browser.tabs.query({active: true}))[0].index;
      props.index = currentIndex + 1;
    }
    delete props.afterCurrent;
    browser.tabs.create(props);
  },
  _search(val) {
    this._tabList.filter(val);
    this._topMenu.updateSearch(val);
  },
  _setupListeners() {
    window.addEventListener("beforeunload", () => {
      browser.runtime.sendMessage({
        event: "sidebar-closed",
        windowId: this._windowId
      });
    });
    window.addEventListener("contextmenu", (e) => {
      const target = e.target;
      // Let the searchbox input have a context menu.
      if (!(target && target.tagName === "INPUT" && target.type === "text")) {
        e.preventDefault();
      }
    }, false);
    browser.storage.onChanged.addListener(changes => this._applyPrefs(unwrapChanges(changes)));
  },
  set _customCSS(cssText) {
    document.getElementById("customCSS").innerHTML = cssText;
  },
  set _darkTheme(isDarkTheme) {
    if (isDarkTheme) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  },
  _readPrefs() {
    return browser.storage.local.get({
      customCSS: "",
      darkTheme: false,
      compactModeMode: 1/* COMPACT_MODE_DYNAMIC */,
      compactPins: true
    });
  },
  _applyPrefs(prefs) {
    if (prefs.hasOwnProperty("customCSS")) {
      this._customCSS = prefs.customCSS;
    }
    if (prefs.hasOwnProperty("darkTheme")) {
      this._darkTheme = prefs.darkTheme;
    }
  }
};

function unwrapChanges(changes) {
  const unwrapped = {};
  for (const [pref, change] of Object.entries(changes)) {
    unwrapped[pref] = change.newValue;
  }
  return unwrapped;
}

// Start-it up!
const tabCenter = new TabCenter();
tabCenter.init();
