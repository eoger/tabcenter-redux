document.getElementById("optionsTitle").textContent =
  browser.i18n.getMessage("optionsTitle");
document.getElementById("alwaysShrinkLabel").textContent =
  browser.i18n.getMessage("optionsAlwaysShrinkTabs");
document.getElementById("darkThemeLabel").textContent =
  browser.i18n.getMessage("optionsDarkTheme");
document.getElementById("useRegExpFilterLabel").textContent =
  browser.i18n.getMessage("useRegExpFilter");

setupCheckboxOption("alwaysShrink", "alwaysShrink");
setupCheckboxOption("darkTheme", "darkTheme");
setupCheckboxOption("useRegExpFilter", "useRegExpFilter");

function setupCheckboxOption(checkboxId, optionName) {
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
