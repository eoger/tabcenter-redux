document.getElementById("optionsTitle").textContent =
  browser.i18n.getMessage("optionsTitle");
document.getElementById("alwaysShrinkLabel").textContent =
  browser.i18n.getMessage("optionsAlwaysShrinkTabs");

const alwaysShrinkCheckbox = document.getElementById("alwaysShrink");
browser.storage.local.get({
  alwaysShrink: false
}).then(({alwaysShrink}) => {
  alwaysShrinkCheckbox.checked = alwaysShrink;
});

alwaysShrinkCheckbox.addEventListener("change", e => {
  browser.storage.local.set({
    alwaysShrink: e.target.checked
  });
});
