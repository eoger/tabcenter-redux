function NewTabPopup({openTab, onHide}) {
  this._openTab = openTab;
  this._onHide = onHide;
  this._newTabMenu = document.getElementById("newtab-menu");
  this._setupListeners();
}

NewTabPopup.prototype = {
  show(identities) {
    const fragment = document.createDocumentFragment();
    for (let identity of identities) {
      const identityItem = document.createElement("div");
      identityItem.className = "newtab-menu-identity";
      identityItem.setAttribute("cookieStoreId", identity.cookieStoreId);
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
    this._newTabMenu.appendChild(fragment);
    this._newTabMenu.classList.remove("hidden");
  },
  _setupListeners() {
    this._onBlur = this.hide.bind(this);
    this._onMouseDown = (e) => {
      if (!e.target.classList.contains("newtab-menu-identity")) {
        this.hide();
      }
    };
    this._onMouseUp = this._handleClick.bind(this, 0, false);
    this._onAuxClick = this._handleClick.bind(this, 1, true);
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("mousedown", this._onMouseDown);
    this._newTabMenu.addEventListener("mouseup", this._onMouseUp);
    this._newTabMenu.addEventListener("auxclick", this._onAuxClick);
  },
  _removeListeners() {
    window.removeEventListener("blur", this._onBlur);
    window.removeEventListener("mousedown", this._onMouseDown);
    this._newTabMenu.removeEventListener("mouseup", this._onMouseUp);
    this._newTabMenu.removeEventListener("auxclick", this._onAuxClick);
  },
  _handleClick(btn, openTabAfterCurrent, e) {
    if (e.button !== btn) {
      return;
    }
    const cookieStoreId = e.target.getAttribute("cookieStoreId");
    this.hide();
    this._openTab({afterCurrent: openTabAfterCurrent, cookieStoreId});
  },
  hide() {
    this._removeListeners();
    this._newTabMenu.classList.add("hidden");

    // Clear the menu.
    while (this._newTabMenu.firstChild) {
      this._newTabMenu.removeChild(this._newTabMenu.firstChild);
    }
    this._onHide();
  }
};

module.exports = NewTabPopup;
