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
    this.buildViewStructure();

    this.view.id = `tab-${this.id}`;
    this.view.setAttribute("data-tab-id", this.id);

    this.updateTitle(tabInfo.title);
    this.updateURL(tabInfo.url);
    this.updateAudible(tabInfo.audible);
    this.updatedMuted(tabInfo.mutedInfo.muted);
    this.updateIcon(tabInfo.favIconUrl);
    this.updatePinned(tabInfo.pinned);
    if (tabInfo.cookieStoreId) {
      // This work is done in the background on purpose: making create() async
      // creates all sorts of bugs, because it is called in observers (which
      // cannot be async).
      browser.contextualIdentities.get(tabInfo.cookieStoreId).then(context => {
        this.updateContext(context);
      });
    }
  },
  buildViewStructure() {
    const tab = document.createElement("div");
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
    icon.addEventListener("error", () => this._resetIcon());
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

    const close = document.createElement("div");
    close.className = "tab-close clickable";
    close.title = browser.i18n.getMessage("closeTabButtonTooltip");

    tab.appendChild(context);
    tab.appendChild(iconOverlay);
    tab.appendChild(metaImage);
    tab.appendChild(titleWrapper);
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
  scrollIntoView() {
    const {top: parentTop, height} = this.view.parentNode.parentNode.getBoundingClientRect();
    let {top, bottom} = this.view.getBoundingClientRect();
    top -= parentTop;
    bottom -= parentTop;
    if (top < 0) {
      this.view.scrollIntoView({block: "start", behavior: "smooth"});
    } else if (bottom > height) {
      this.view.scrollIntoView({block: "end", behavior: "smooth"});
    }
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
  updateIcon(favIconUrl) {
    if (favIconUrl) {
      this._setIcon(favIconUrl);
    } else {
      this._resetIcon();
    }
  },
  _setIcon(url) {
    this._iconView.src = url;
  },
  _resetIcon() {
    this._setIcon("img/defaultFavicon.svg");
  },
  setSpinner() {
    this._setIcon("img/loading-spinner.svg");
  },
  updatePinned(pinned) {
    this.pinned = pinned;
    toggleClass(this.view, "pinned", pinned);
    if (pinned) {
      this.resetThumbnail();
    }
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
  },
  resetThumbnail() {
    this._metaImageView.style.backgroundImage = "";
    this._metaImageView.classList.remove("has-thumbnail");
  }
};

// Static methods
Object.assign(SideTab, {
  // If strict is true, this will return false for subviews (e.g the close button).
  isTabEvent(e, strict = true) {
    let el = e.target;
    if (!el) {
      return false;
    }
    const isTabNode = (node) => node && node.classList.contains("tab");
    if (isTabNode(el)) {
      return true;
    }
    if (strict) {
      return false;
    }
    while ((el = el.parentElement)) {
      if (isTabNode(el)) {
        return true;
      }
    }
    return false;
  },
  isCloseButtonEvent(e) {
    return e.target && e.target.classList.contains("tab-close");
  },
  isIconOverlayEvent(e) {
    return e.target && e.target.classList.contains("tab-icon-overlay");
  },
  tabIdForView(el) {
    if (!el) {
      return null;
    }
    return el.getAttribute("data-tab-id");
  },
  tabIdForEvent(e) {
    let el = e.target;
    // eslint-disable-next-line curly
    while (!SideTab.tabIdForView(el) && (el = el.parentElement));
    return parseInt(SideTab.tabIdForView(el));
  },
  getAllTabsViews() {
    return document.getElementsByClassName("tab");
  }
});

function toggleClass(node, className, boolean) {
  boolean ? node.classList.add(className) : node.classList.remove(className);
}

module.exports = SideTab;
