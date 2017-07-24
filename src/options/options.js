document.getElementById("optionsTitle").textContent =
  browser.i18n.getMessage("optionsTitle");
document.getElementById("compactModeLabel").textContent =
  browser.i18n.getMessage("optionsCompactMode");
document.getElementById("darkThemeLabel").textContent =
  browser.i18n.getMessage("optionsDarkTheme");

setupCheckboxOption("compactMode", "compactMode");
setupCheckboxOption("darkTheme", "darkTheme");

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
