const SideTabList = require("./tablist.js");

function TabCenter() {
  this.init();
}

TabCenter.prototype = {
  async init() {
    this._newTabButtonView = document.getElementById("newtab-label");
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
      browser.tabs.create({});
    });
    window.addEventListener("keyup", (e) => {
      if (e.keyCode === 27) { // Clear search on ESC key pressed
        this.sideTabList.clearSearch();
      }
    });
  },
  setupLabels() {
    this._newTabButtonView.textContent = browser.i18n.getMessage("newTabBtnLabel");
    this._newTabButtonView.title = browser.i18n.getMessage("newTabBtnTooltip");
  }
};

// Start-it up!
new TabCenter();

// TODO: Find a solution to show only our items in the tab context menu while
// keeping a native look. Until then disable it. See bug 1367160
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
}, false);
