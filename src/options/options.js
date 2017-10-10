function TabCenterOptions() {
  this.setupLabels();
  this.setupStateAndListeners();
}

TabCenterOptions.prototype = {
  setupLabels() {
    const options = ["optionsTitle", "optionsCompactMode",
      "optionsCompactModeStrict", "optionsCompactModeDynamic",
      "optionsCompactModeOff", "optionsDarkTheme",
      "optionsAdvancedTitle", "optionsCustomCSS", "optionsSaveCustomCSS"];
    for (let opt of options) {
      this._setupTextContentLabel(opt);
    }
  },
  _setupTextContentLabel(opt) {
    document.getElementById(opt).textContent = browser.i18n.getMessage(opt);
  },
  setupStateAndListeners() {
    this._setupCheckboxOption("darkTheme", "darkTheme");
    this._setupDropdownOption("compactMode", "compactModeCounter");

    // Custom CSS
    browser.storage.local.get({
      ["customCSS"]: ""
    }).then(prefs => {
      document.getElementById("customCSS").value = prefs["customCSS"];
    });
    document.getElementById("optionsSaveCustomCSS").addEventListener("click", () => {
      browser.storage.local.set({
        ["customCSS"]: document.getElementById("customCSS").value
      });
    });
  },
  _setupCheckboxOption(checkboxId, optionName) {
    const checkbox = document.getElementById(checkboxId);
    browser.storage.local.get({
      [optionName]: false
    }).then(prefs => {
      checkbox.checked = prefs[optionName]
    });

    checkbox.addEventListener("change", e => {
      browser.storage.local.set({
        [optionName]: e.target.checked
      });
    });
  },
  _setupDropdownOption(drowdownId, optionName) {
    const dropdown = document.getElementById(drowdownId);
    browser.storage.local.get({
      [optionName]: 0
    }).then(prefs => {
      dropdown.value = prefs[optionName];
    });

    dropdown.addEventListener("change", e => {
      browser.storage.local.set({
        [optionName]: e.target.value
      });
    });
  }
};

new TabCenterOptions();
