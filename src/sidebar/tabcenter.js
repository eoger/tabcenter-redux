const TabList = require("./tablist.js");

const LONG_PRESS_DELAY = 500;

function TabCenter() {
}
TabCenter.prototype = {
  async init() {
    // Do other work while the promises are pending.
    const prefsPromise = this._readPrefs();
    const windowPromise = browser.windows.getCurrent();

    this._newTabButtonView = document.getElementById("newtab");
    this._newTabMenu = document.getElementById("newtab-menu");
    this._newTabLabelView = document.getElementById("newtab-label");
    this._settingsView = document.getElementById("settings");
    this._searchBoxInput = document.getElementById("searchbox-input");
    this._setupLabels();
    this._setupListeners();

    const prefs = await prefsPromise;
    this._applyPrefs(prefs);
    this._tabList = new TabList(prefs);
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
  _setupListeners() {
    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });

    const searchbox = document.getElementById("searchbox");
    this._searchBoxInput.addEventListener("input", (e) => {
      this._tabList._filter(e.target.value);
    });
    this._searchBoxInput.addEventListener("focus", () => {
      searchbox.classList.add("focused");
      this._newTabLabelView.classList.add("hidden");
    });
    this._searchBoxInput.addEventListener("blur", () => {
      searchbox.classList.remove("focused");
      this._newTabLabelView.classList.remove("hidden");
    });

    this._newTabButtonView.addEventListener("click", () => {
      if (!this._newTabMenuShown) {
        browser.tabs.create({});
      }
    });
    this._newTabButtonView.addEventListener("auxclick", e => {
      if (e.which === 2) {
        this._createTabAfterCurrent();
      } else if (e.which === 3) {
        this._showNewTabMenu();
      }
    });
    this._newTabButtonView.addEventListener("mousedown", () => {
      this._longPressTimer = setTimeout(() => {
        this._showNewTabMenu();
      }, LONG_PRESS_DELAY);
    });
    this._newTabButtonView.addEventListener("mouseup", () => {
      clearTimeout(this._longPressTimer);
    });

    window.addEventListener("keyup", (e) => {
      if (e.keyCode === 27) { // Clear search on ESC key pressed
        this._tabList.clearSearch();
      }
    });
    window.addEventListener("mousedown", (e) => {
      if (!e.target.classList.contains("newtab-menu-identity")) {
        this._hideNewTabMenu();
      }
    });
    window.addEventListener("blur", () => {
      this._hideNewTabMenu();
    });
    window.addEventListener("beforeunload", () => {
      browser.runtime.sendMessage({
        event: "sidebar-closed",
        windowId: this._windowId
      });
    });
    window.addEventListener("contextmenu", (e) => {
      if (e.target !== this._searchBoxInput) {
        e.preventDefault();
      }
    }, false);
    browser.storage.onChanged.addListener(changes => this._applyPrefs(unwrapChanges(changes)));
  },
  _setupLabels() {
    this._newTabLabelView.textContent = browser.i18n.getMessage("newTabBtnLabel");
    this._newTabLabelView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._searchBoxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
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
  },
  async _createTabAfterCurrent(cookieStoreId = null) {
    let currentIndex = (await browser.tabs.query({active: true}))[0].index;
    let props = {index: currentIndex + 1};
    if (cookieStoreId) {
      props.cookieStoreId = cookieStoreId;
    }
    browser.tabs.create(props);
  },
  async _showNewTabMenu() {
    if (!browser.contextualIdentities) {
      return;
    }
    this._newTabMenuShown = true;
    // Create the identities
    const identities = await browser.contextualIdentities.query({});
    if (!identities) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (let identity of identities) {
      const identityItem = document.createElement("div");
      identityItem.className = "newtab-menu-identity";
      identityItem.addEventListener("mouseup", e => {
        if (e.which !== 1) {
          return;
        }
        this._hideNewTabMenu();
        browser.tabs.create({cookieStoreId: identity.cookieStoreId});
      });
      identityItem.addEventListener("auxclick", e => {
        if (e.which === 2) {
          this._hideNewTabMenu();
          this._createTabAfterCurrent(identity.cookieStoreId);
        }
      });
      const identityIcon = document.createElement("div");
      identityIcon.classList.add("newtab-menu-identity-icon");
      identityIcon.setAttribute("data-identity-color", identity.color);
      identityIcon.setAttribute("data-identity-icon", identity.icon);
      identityItem.appendChild(identityIcon);
      const identityLabel = document.createElement("div");
      identityLabel.className = "newtab-menu-identity-label";
      identityLabel.textContent = identity.name;
      identityItem.appendChild(identityLabel);
      fragment.appendChild(identityItem);
    }

    // Append the identities and show the menu
    this._newTabMenu.appendChild(fragment);
    this._newTabMenu.classList.remove("hidden");

    this._newTabButtonView.classList.add("menuopened");
  },
  _hideNewTabMenu() {
    this._newTabMenuShown = false;
    this._newTabMenu.classList.add("hidden");
    this._newTabButtonView.classList.remove("menuopened");

    // Clear the menu
    while (this._newTabMenu.firstChild) {
      this._newTabMenu.removeChild(this._newTabMenu.firstChild);
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
