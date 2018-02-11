function SideTab() {
  this.id = null;
  this.url = null;
  this.title = null;
  this.muted = null;
  this.pinned = null;
  this.visible = true;
}

SideTab.prototype = {
  init(tabInfo) {
    this.id = tabInfo.id;
    this.buildViewStructure();

    this.view.id = `tab-${this.id}`;
    this.view.setAttribute("data-tab-id", this.id);

    this.updateTitle(tabInfo.title);
    this.updateURL(tabInfo.url);
    this.updateAudible(tabInfo.audible);
    this.updatedMuted(tabInfo.mutedInfo.muted);
    if (tabInfo.hasOwnProperty("favIconUrl")) {
      this.updateIcon(tabInfo.favIconUrl);
    }
    this.updatePinned(tabInfo.pinned);
    this.updateDiscarded(tabInfo.discarded);
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

    const burst = document.createElement("div");
    burst.className = "tab-loading-burst";
    this._burstView = burst;

    const context = document.createElement("div");
    context.className = "tab-context";
    this._contextView = context;

    const iconOverlay = document.createElement("div");
    iconOverlay.className = "tab-icon-overlay clickable";
    this._iconOverlayView = iconOverlay;

    const metaImage = document.createElement("div");
    metaImage.className = "tab-meta-image";
    this._metaImageView = metaImage;

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "tab-icon-wrapper";
    const icon = document.createElement("div");
    icon.className = "tab-icon";
    iconWrapper.appendChild(icon);
    metaImage.appendChild(iconWrapper);
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
    // This makes the close button an event target for dragstart, which
    // allows us to cancel the drag if the user initiated the drag from here!
    close.draggable = true;
    close.title = browser.i18n.getMessage("closeTabButtonTooltip");

    tab.appendChild(burst);
    tab.appendChild(context);
    tab.appendChild(iconOverlay);
    tab.appendChild(metaImage);
    tab.appendChild(titleWrapper);
    tab.appendChild(pin);
    tab.appendChild(close);
  },
  matches(tokens) {
    if (tokens.length === 0) {
      return true;
    }
    let title = normalizeStr(this.title);
    let url = normalizeStr(this.url);
    for (let token of tokens) {
      token = normalizeStr(token);
      if (title.includes(token)) {
        return true;
      }
      if (url.includes(token)) {
        return true;
      }
    }
    return false;
  },
  _highlightSearchResults(node, text, searchTokens) {
    let ranges = findHighlightedRanges(text, searchTokens);

    // Clear out the node before we fill it with new stuff.
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }

    for (let {text, highlight} of ranges) {
      if (highlight) {
        let span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = text;
        node.appendChild(span);
      } else {
        node.appendChild(document.createTextNode(text));
      }
    }
  },
  highlightMatches(tokens) {
    if (!this.visible) {
      // Reset these to the 'no matches' state (Not calling
      // _highlightSearchResult is just an optimization).
      this.updateTitle(this.title);
      this.updateURL(this.url);
    } else {
      this._highlightSearchResults(this._titleView, this.title, tokens);
      this._highlightSearchResults(this._hostView, getHost(this.url), tokens);
    }
  },
  updateTitle(title) {
    this.title = title;
    this._titleView.innerText = title;
    this.view.title = title;
  },
  updateURL(url) {
    const host = getHost(url);
    this.url = url;
    this._hostView.innerText = host;
  },
  updateActive(active) {
    toggleClass(this.view, "active", active);
    if (active) {
      this._notselectedsinceload = false;
      this.view.removeAttribute("notselectedsinceload");
    }
  },
  scrollIntoView() {
    // Avoid an expensive sync reflow (scrolling).
    requestAnimationFrame(() => {
      this._scrollIntoView();
    });
  },
  _scrollIntoView() {
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
    if (!favIconUrl) {
      return;
    }
    this._iconView.style.backgroundImage = `url("${favIconUrl}")`;
    const imgTest = document.createElement("img");
    imgTest.src = favIconUrl;
    imgTest.onerror = () => {
      this.resetIcon();
    };
  },
  resetIcon() {
    this._iconView.style.backgroundImage = "";
  },
  setLoading(isLoading) {
    toggleClass(this.view, "loading", isLoading);
    if (isLoading) {
      SideTab._syncThrobberAnimations();
      this._notselectedsinceload = !this.view.classList.contains("active");
    } else {
      if (this._notselectedsinceload) {
        this.view.setAttribute("notselectedsinceload", "true");
      } else {
        this.view.removeAttribute("notselectedsinceload");
      }
      this._burstView.classList.add("bursting");
    }
  },
  updatePinned(pinned) {
    this.pinned = pinned;
    toggleClass(this.view, "pinned", pinned);
  },
  updateDiscarded(discarded) {
    toggleClass(this.view, "discarded", discarded);
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
  },
  onAnimationEnd(e) {
    if (e.target.classList.contains("tab-loading-burst")) {
      this._burstView.classList.remove("bursting");
    }
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
    return parseInt(el.getAttribute("data-tab-id"));
  },
  tabIdForEvent(e) {
    let el = e.target;
    // eslint-disable-next-line curly
    while (!SideTab.tabIdForView(el) && (el = el.parentElement));
    return SideTab.tabIdForView(el);
  },
  getAllTabsViews() {
    return document.getElementsByClassName("tab");
  },
  _syncThrobberAnimations() {
    requestAnimationFrame(() => {
      if (!document.body.getAnimations) { // this API is available only in Nightly so far
        return;
      }
      setTimeout(() => {
        const animations = [...document.querySelectorAll(".tab.loading .tab-icon")]
          .map(tabIcon => tabIcon.getAnimations({ subtree: true }))
          .reduce((a, b) => a.concat(b))
          .filter(anim =>
            anim instanceof CSSAnimation &&
            anim.animationName === "tab-throbber-animation" &&
            (anim.playState === "running" || anim.playState === "pending"));

        // Synchronize with the oldest running animation, if any.
        const firstStartTime = Math.min(
          ...animations.map(anim => anim.startTime === null ? Infinity : anim.startTime)
        );
        if (firstStartTime === Infinity) {
          return;
        }
        requestAnimationFrame(() => {
          for (let animation of animations) {
            // If |animation| has been cancelled since this rAF callback
            // was scheduled we don't want to set its startTime since
            // that would restart it. We check for a cancelled animation
            // by looking for a null currentTime rather than checking
            // the playState, since reading the playState of
            // a CSSAnimation object will flush style.
            if (animation.currentTime !== null) {
              animation.startTime = firstStartTime;
            }
          }
        });
      }, 0);
    });
  },
});

function toggleClass(node, className, boolean) {
  boolean ? node.classList.add(className) : node.classList.remove(className);
}

// Remove case and accents/diacritics.
function normalizeStr(str) {
  return str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
}

function getHost(url) {
  return new URL(url).host || url;
}

// This function takes as input a text string and an array of "search tokens"
// and returns what we should render in an abstract sense. e.g. an array of
// `{text: string, highlighted: bool}`, such that `result.map(r =>
// r.text).join('')` should equal what was provided as the first argument, and
// that the sections with `highlighted: true` correspond to ranges that match
// the members of searchTokens.
//
// (It's complex enough to arguably warrant unit tests, but oh well, it's split
// out so that I could more easily test it manually).
function findHighlightedRanges(text, searchTokens) {
  // Trivial case
  if (searchTokens.length === 0) {
    return [{text, highlighted: false}];
  }
  // Potentially surprisingly, changing case doesn't preserve length. If we
  // can't do this without messing up the indices in the given text, we fail.
  // This function is just for highlighting the matching parts in searches in
  // the UI, so it's not a big deal if it doesn't highlight something.
  let canLowercaseText = text.toLowerCase().length === text.length &&
                         searchTokens.every(t =>
                           t.toLowerCase().length === t.length);
  let normalize = s => canLowercaseText ? s.toLowerCase() : s;
  let normText = normalize(text);

  // Build an array of the start/end indices of each result.
  let ranges = [];
  for (let token of searchTokens) {
    token = normalize(token);
    if (!token.length) {
      continue;
    }
    for (let index = normText.indexOf(token);
         index >= 0;
         index = normText.indexOf(token, index + 1)) {
      ranges.push({start: index, end: index + token.length});
    }
  }
  if (ranges.length === 0) {
    return [{text, highlighted: false}];
  }

  // Order them in the order they appear in the text (as it is they're ordered
  // first by the order of the tokens in searchTokens, and then by the
  // position in the text).
  ranges.sort((a, b) => a.start - b.start);

  let coalesced = [ranges[0]];
  for (let i = 1; i < ranges.length; ++i) {
    let prev = coalesced[coalesced.length - 1];
    let curr = ranges[i];
    if (curr.start < prev.end) {
      // Overlap, update prev, but don't add curr.
      if (curr.end > prev.end) {
        prev.end = curr.end;
      }
    } else {
      coalesced.push(curr);
    }
  }

  let result = [];
  let pos = 0;
  for (let range of coalesced) {
    if (pos < range.start) {
      result.push({text: text.slice(pos, range.start), highlight: false});
    }
    result.push({text: text.slice(range.start, range.end), highlight: true});
    pos = range.end;
  }
  if (pos < text.length) {
    result.push({text: text.slice(pos), highlight: false});
  }

  return result;
}

module.exports = SideTab;
