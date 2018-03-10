const LONG_PRESS_DELAY = 500;

const NewTabPopup = require("./newtabpopup");

function TopMenu({openTab, search}) {
  this._newTabButtonView = document.getElementById("newtab");
  this._settingsView = document.getElementById("settings");
  this._searchBoxInput = document.getElementById("searchbox-input");
  this._newTabLabelView = document.getElementById("newtab-label");
  this._setupLabels();
  this._setupListeners();

  this._search = search;
  this._openTab = openTab;
}

TopMenu.prototype = {
  updateSearch(val) {
    this._searchBoxInput.value = val;
  },
  _setupListeners() {
    this._settingsView.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });

    const searchbox = document.getElementById("searchbox");
    this._searchBoxInput.addEventListener("input", (e) => {
      this._search(e.target.value);
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
      if (!this._newTabPopup) {
        this._openTab();
      }
    });
    this._newTabButtonView.addEventListener("auxclick", e => {
      if (e.button === 1) {
        this._openTab({afterCurrent: true});
      } else if (e.button === 2) {
        this._showNewTabPopup();
      }
    });
    this._newTabButtonView.addEventListener("mousedown", () => {
      this._longPressTimer = setTimeout(() => {
        this._showNewTabPopup();
      }, LONG_PRESS_DELAY);
    });
    this._newTabButtonView.addEventListener("mouseup", () => {
      clearTimeout(this._longPressTimer);
    });

    window.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        this._search("");
      }
    });
  },
  _setupLabels() {
    this._newTabLabelView.textContent = browser.i18n.getMessage("newTabBtnLabel");
    this._newTabLabelView.title = browser.i18n.getMessage("newTabBtnTooltip");
    this._settingsView.title = browser.i18n.getMessage("settingsBtnTooltip");
    this._searchBoxInput.placeholder = browser.i18n.getMessage("searchPlaceholder");
  },
  async _showNewTabPopup() {
    if (!browser.contextualIdentities) {
      return;
    }
    const identities = await browser.contextualIdentities.query({});
    if (!identities || !identities.length) {
      return;
    }
    const openTab = this._openTab.bind(this);
    const onHide = this._onNewTabPopupHidden.bind(this);
    this._newTabPopup = new NewTabPopup({openTab, onHide});
    this._newTabPopup.show(identities);
    this._newTabButtonView.classList.add("menuopened");
  },
  _onNewTabPopupHidden() {
    this._newTabPopup = null;
    this._newTabButtonView.classList.remove("menuopened");
  }
};

module.exports = TopMenu;
