function TabCenterOptions() {
  this.setupLabels();
  this.setupStateAndListeners();
}

TabCenterOptions.prototype = {
  setupLabels() {
    const options = ["optionsTitle", "optionsCompactMode",
      "optionsCompactPins", "optionsDarkTheme", "optionsAdvancedTitle",
      "optionsCustomCSS", "optionsSaveCustomCSS"];
    for (let opt of options) {
      this._setupTextContentLabel(opt);
    }
  },
  _setupTextContentLabel(opt) {
    document.getElementById(opt).textContent = browser.i18n.getMessage(opt);
  },
  setupStateAndListeners() {
    this._setupCheckboxOption("compactMode", "compactMode");
    this._setupCheckboxOption("compactPins", "compactPins");
    this._setupCheckboxOption("darkTheme", "darkTheme");

    browser.storage.local.get({
      "compactPins": true,
      "customCSS": ""
    }).then(prefs => {
      document.getElementById("customCSS").value = prefs["customCSS"];
      document.getElementById("compactPins").checked = prefs["compactPins"];
    });
    document.getElementById("optionsSaveCustomCSS").addEventListener("click", () => {
      browser.storage.local.set({
        "customCSS": document.getElementById("customCSS").value
      });
    });
  },
  _setupCheckboxOption(checkboxId, optionName) {
    const checkbox = document.getElementById(checkboxId);
    browser.storage.local.get({
      [optionName]: false
    }).then(prefs => {
      checkbox.checked = prefs[optionName];
    });

    checkbox.addEventListener("change", e => {
      browser.storage.local.set({
        [optionName]: e.target.checked
      });
    });
  }
};

new TabCenterOptions();
