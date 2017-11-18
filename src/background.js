function TabCenterBackground() {
  browser.runtime.onMessage.addListener((msg) => this.onMessage(msg));
  browser.browserAction.onClicked.addListener((tab) => this.onClick(tab));
}
TabCenterBackground.prototype = {
  openedSidebarWindows: new Set(),
  onMessage({event, windowId}) {
    if (event == "sidebar-open") {
      this.openedSidebarWindows.add(windowId);
    } else {
      this.openedSidebarWindows.delete(windowId);
    }
  },
  onClick({windowId}) {
    if (this.openedSidebarWindows.has(windowId)) {
      // TODO: Remove this once "beforeunload" actually works.
      this.openedSidebarWindows.delete(windowId);
      browser.sidebarAction.close();
    } else {
      browser.sidebarAction.open();
    }
  }
};

new TabCenterBackground();
