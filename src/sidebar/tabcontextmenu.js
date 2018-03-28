import ContextMenu from "./lib/contextmenu/contextmenu.js";

/* @arg {props}
 * tab
 * posX
 * poxY
 * onClose
 * canMoveToNewWindow
 * reloadAllTabs
 * closeTabsAfter
 * closeOtherTabs
 * canUndoCloseTab
 * undoCloseTab
 */
function TabContextMenu(props) {
  this._props = props;
  this._contextMenu = new ContextMenu(props.posX, props.posY);
}
TabContextMenu.prototype = {
  show() {
    const items = this._createContextMenuItems(this._props.tab);
    this._contextMenu.show(items);
    this._setupListeners();
  },
  _setupListeners() {
    const closeIf = (predicateFun, e) => {
      if (predicateFun(e)) {
        this.close();
      }
    };
    this._onKeyUp = closeIf.bind(this, e => e.key === "Escape");
    this._onClick = closeIf.bind(this, e => e.button === 0);
    this._onBlur = closeIf.bind(this, () => true);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("click", this._onClick);
    window.addEventListener("blur", this._onBlur);
  },
  _removeListeners() {
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("click", this._onClick);
    window.removeEventListener("blur", this._onBlur);
  },
  close() {
    this._removeListeners();
    this._contextMenu.hide();
    this._props.onClose();
  },
  _createContextMenuItems(tab) {
    const items = [];
    items.push({
      label: browser.i18n.getMessage("contextMenuReloadTab"),
      onCommandFn: () => {
        browser.tabs.reload(tab.id);
      }
    });
    items.push({
      label: browser.i18n.getMessage(tab.muted ? "contextMenuUnmuteTab" :
                                                 "contextMenuMuteTab"),
      onCommandFn: () => {
        browser.tabs.update(tab.id, {"muted": !tab.muted});
      }
    });
    items.push({
      label: "separator"
    });
    items.push({
      label: browser.i18n.getMessage(tab.pinned ? "contextMenuUnpinTab" :
                                                  "contextMenuPinTab"),
      onCommandFn: () => {
        browser.tabs.update(tab.id, {"pinned": !tab.pinned});
      }
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuDuplicateTab"),
      onCommandFn: () => {
        browser.tabs.duplicate(tab.id);
      }
    });
    if (this._props.canMoveToNewWindow) {
      items.push({
        label: browser.i18n.getMessage("contextMenuMoveTabToNewWindow"),
        onCommandFn: () => {
          browser.windows.create({tabId: tab.id});
        }
      });
    }
    items.push({
      label: "separator"
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuReloadAllTabs"),
      onCommandFn: this._props.reloadAllTabs
    });
    if (!tab.pinned) {
      items.push({
        label: browser.i18n.getMessage("contextMenuCloseTabsUnderneath"),
        onCommandFn: this._props.closeTabsAfter
      });
      items.push({
        label: browser.i18n.getMessage("contextMenuCloseOtherTabs"),
        onCommandFn: this._props.closeOtherTabs
      });
    }
    items.push({
      label: "separator"
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuUndoCloseTab"),
      isEnabled: this._props.canUndoCloseTab,
      onCommandFn: this._props.undoCloseTab
    });
    items.push({
      label: browser.i18n.getMessage("contextMenuCloseTab"),
      onCommandFn: () => {
        browser.tabs.remove(tab.id);
      }
    });
    return items;
  },
};

export default TabContextMenu;
