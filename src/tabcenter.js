const SideTabList = require("./tablist.js");

function TabCenter() {
  this.init();
}

TabCenter.prototype = {
  async init() {
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
    document.getElementById("newtab").addEventListener("click", () => {
      browser.tabs.create({});
    });
    window.addEventListener("keyup", (e) => {
      if (e.keyCode === 27) { // Clear search on ESC key pressed
        this.sideTabList.clearSearch();
      }
    });
  },
  setupLabels() {
    document.getElementById("newtab-label").textContent =
      browser.i18n.getMessage("newTabLabel");
  }
};

// Start-it up!
new TabCenter();

// TODO: Find a solution to show only our items in the tab context menu while
// keeping a native look. Until then disable it. See bug 1367160
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
}, false);
