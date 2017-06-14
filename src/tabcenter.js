const SideTabList = require("./tablist.js");

const LONG_PRESS_DELAY = 500;

function TabCenter() {
  this.init();
}

TabCenter.prototype = {
  async init() {
    this._newTabButtonView = document.getElementById("newtab");
    this._newTabMenu = document.getElementById("newtab-menu");
    this.setupLabels();
    const data = await browser.windows.getCurrent();
    this.sideTabList = new SideTabList();
    this.sideTabList.populate(data.id);
    this.setupListeners();
  },
  setupListeners() {
    const searboxInput = document.getElementById("searchbox-input");
    searboxInput.addEventListener("keyup", (e) => {
      this.sideTabList.filter(e.target.value);
    });
    browser.commands.onCommand.addListener((command) => {
      if (command == "focus-searchbox") {
        searboxInput.focus();
      }
    });
    this._newTabButtonView.addEventListener("click", () => {
      if (!this._newTabMenuShown) {
        browser.tabs.create({});
      }
    });
    this._newTabButtonView.addEventListener("mousedown", () => {
      this._longPressTimer = setTimeout(() => {
        if (browser.contextualIdentities) {
          this.showNewTabMenu();
        }
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
  },
  setupLabels() {
    const newTabLabel = document.getElementById("newtab-label");
    newTabLabel.textContent = browser.i18n.getMessage("newTabBtnLabel");
    newTabLabel.title = browser.i18n.getMessage("newTabBtnTooltip");
  },
  async showNewTabMenu() {
    this._newTabMenuShown = true;
    // Create the identities
    const identities = await browser.contextualIdentities.query({});
    const fragment = document.createDocumentFragment();
    for (let identity of identities) {
      const identityItem = document.createElement("div");
      identityItem.className = "newtab-menu-identity";
      identityItem.addEventListener("mouseup", () => {
        this.hideNewTabMenu();
        browser.tabs.create({ cookieStoreId: identity.cookieStoreId });
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
new TabCenter();

// TODO: Find a solution to show only our items in the tab context menu while
// keeping a native look. Until then disable it. See bug 1367160
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
}, false);
