const SideTabList = require("./tablist.js");

const LONG_PRESS_DELAY = 500;

function TabCenter() {
  this.sideTabList = new SideTabList();
}

TabCenter.prototype = {
  async init() {
    this._injectCustomCSS();
    this._detectDarkTheme();

    this._newTabButtonView = document.getElementById("newtab");
    this._newTabMenu = document.getElementById("newtab-menu");
    this._newTabLabelView = document.getElementById("newtab-label");
    this._settingsView = document.getElementById("settings");
    this._searchBoxInput = document.getElementById("searchbox-input");
    this.setupLabels();
    await this.sideTabList.init();
    const {id: windowId} = await browser.windows.getCurrent();
    this.windowId = windowId;
    browser.runtime.sendMessage({
      event: "sidebar-open",
      windowId
    });
    await this.sideTabList.populate(windowId);
    this.setupListeners();
    browser.runtime.getPlatformInfo().then((platform) => {
      document.body.setAttribute("platform", platform.os);
    });
  },
  setupListeners() {
    const searchbox = document.getElementById("searchbox");
    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });
    this._searchBoxInput.addEventListener("input", (e) => {
      this.sideTabList.filter(e.target.value);
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
      if (e.which == 2) {
        this._createTabAfterCurrent();
      } else if (e.which == 3) {
        this.showNewTabMenu();
      }
    });
    this._newTabButtonView.addEventListener("mousedown", () => {
      this._longPressTimer = setTimeout(() => {
        this.showNewTabMenu();
      }, LONG_PRESS_DELAY);
    });
    this._newTabButtonView.addEventListener("mouseup", () => {
      clearTimeout(this._longPressTimer);
    });
    window.addEventListener("keyup", (e) => {
      if (e.keyCode === 27) { // Clear search on ESC key pressed
        this.sideTabList.clearSearch();
      }
    });
    window.addEventListener("mousedown", (e) => {
      if (!e.target.classList.contains("newtab-menu-identity")) {
        this.hideNewTabMenu();
      }
    });
    window.addEventListener("blur", () => {
      this.hideNewTabMenu();
    });
    window.addEventListener("beforeunload", () => {
      browser.runtime.sendMessage({
        event: "sidebar-closed",
        windowId: this.windowId
      });
    });
    browser.storage.onChanged.addListener(changes => {
      if (changes.darkTheme) {
        this.toggleTheme(changes.darkTheme.newValue);
      }
      if (changes.customCSS) {
        const customCSSNode = document.getElementById("customCSS");
        if (customCSSNode) {
          customCSSNode.remove();
        }
        this._injectCustomCSS();
      }
    });
  },
  setupLabels() {
    this._newTabLabelView.textContent = browser.i18n.getMessage("newTabBtnLabel");
    this._newTabLabelView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._searchBoxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
  },
  async _injectCustomCSS() {
    const customCSS = (await browser.storage.local.get({
      customCSS: ""
    })).customCSS;
    if (!customCSS) {
      return;
    }
    const styleNode = document.createElement("style");
    styleNode.id = "customCSS";
    styleNode.innerHTML = customCSS;
    document.body.appendChild(styleNode);
  },
  async _detectDarkTheme() {
    const darkTheme = (await browser.storage.local.get({
      darkTheme: false
    })).darkTheme;
    this.toggleTheme(darkTheme);
  },
  toggleTheme(darkTheme) {
    if (darkTheme) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  },
  async _createTabAfterCurrent(cookieStoreId = null) {
    let currentIndex = (await browser.tabs.query({ active: true }))[0].index;
    let props = { index: currentIndex + 1 };
    if (cookieStoreId) {
      props.cookieStoreId = cookieStoreId;
    }
    browser.tabs.create(props);
  },
  async showNewTabMenu() {
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
        if (e.which != 1) {
          return;
        }
        this.hideNewTabMenu();
        browser.tabs.create({ cookieStoreId: identity.cookieStoreId });
      });
      identityItem.addEventListener("auxclick", e => {
        if (e.which == 2) {
          this.hideNewTabMenu();
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
  hideNewTabMenu() {
    this._newTabMenuShown = false;
    this._newTabMenu.classList.add("hidden");
    this._newTabButtonView.classList.remove("menuopened");

    // Clear the menu
    while (this._newTabMenu.firstChild) {
      this._newTabMenu.removeChild(this._newTabMenu.firstChild);
    }
  }
};

// Start-it up!
(async function() {
  const tabCenter = new TabCenter();
  await tabCenter.init();
})();

// TODO: Find a solution to show only our items in the tab context menu while
// keeping a native look. Until then disable it. See bug 1367160
document.addEventListener("contextmenu", (e) => {
  const searboxInput = document.getElementById("searchbox-input");
  if (e.target === searboxInput) {
    return;
  }
  e.preventDefault();
}, false);
