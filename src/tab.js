function toggleClass(node, className, boolean) {
  boolean ? node.classList.add(className) : node.classList.remove(className);
}

function SideTab() {
  this.id = null;
  this.url = null;
  this.title = null;
  this.muted = null;
  this.pinned = null;
  this.visible = true;
}

SideTab.prototype = {
  create(tabInfo) {
    this.id = tabInfo.id;

    const tab = document.createElement("div");
    tab.id = `tab-${this.id}`;
    tab.setAttribute("data-tab-id", this.id);
    tab.className = "tab";
    tab.draggable = true;
    this.view = tab;

    const context = document.createElement("div");
    context.className = "tab-context";
    this._contextView = context;

    const iconOverlay = document.createElement("div");
    iconOverlay.className = "tab-icon-overlay clickable";
    this._iconOverlayView = iconOverlay;

    const metaImage = document.createElement("div");
    metaImage.className = "tab-meta-image";
    this._metaImageView = metaImage;

    const icon = document.createElement("img");
    icon.className = "tab-icon";
    icon.addEventListener("error", () => this.resetIcon());
    metaImage.appendChild(icon);
    this._iconView = icon;

    const titleWrapper = document.createElement("div");
    titleWrapper.className = "tab-title-wrapper";

    const title = document.createElement("span");
    title.className = "tab-title";
    titleWrapper.appendChild(title);
    this._titleView = title;

    const host = document.createElement("span");
    host.className = "tab-host";
    titleWrapper.appendChild(host);
    this._hostView = host;

    const pin = document.createElement("div");
    pin.className = "tab-pin";

    const close = document.createElement("div");
    close.className = "tab-close clickable";
    close.title = browser.i18n.getMessage("closeTabButtonTooltip");

    tab.appendChild(context);
    tab.appendChild(iconOverlay);
    tab.appendChild(metaImage);
    tab.appendChild(titleWrapper);
    tab.appendChild(pin);
    tab.appendChild(close);
  },
  updateTitle(title) {
    this.title = title;
    this._titleView.innerText = title;
    this.view.title = title;
  },
  updateURL(url) {
    const host = new URL(url).host || url;
    this.url = url;
    this._hostView.innerText = host;
  },
  updateActive(active) {
    toggleClass(this.view, "active", active);
  },
  updateVisibility(show) {
    this.visible = show;
    toggleClass(this.view, "hidden", !show);
  },
  updateAudible(audible) {
    toggleClass(this._iconOverlayView, "sound", audible);
  },
  updatedMuted(muted) {
    this.muted = muted;
    toggleClass(this._iconOverlayView, "muted", muted);
  },
  setIcon(url) {
    this._iconView.src = url;
  },
  setSpinner() {
    this.setIcon("img/loading-spinner.svg");
  },
  resetIcon() {
    this.setIcon("img/defaultFavicon.svg");
  },
  updatePinned(pinned) {
    this.pinned = pinned;
    toggleClass(this.view, "pinned", pinned);
  },
  updateContext(context) {
    if (!context) {
      return;
    }
    this._contextView.classList.add("hasContext");
    this._contextView.setAttribute("data-identity-color", context.color);
  },
  updateThumbnail(thumbnail) {
    this._metaImageView.style.backgroundImage = `url(${thumbnail})`;
    this._metaImageView.classList.add("has-thumbnail");
  }
};

module.exports = SideTab;
