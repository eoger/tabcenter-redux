/* eslint-env mocha */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

(async () => {
  await Promise.all([
    loadScript("../test/vendor/mocha.js"),
    loadScript("../test/vendor/chai.js")
  ]);
  mocha.setup({ui: "tdd", timeout: 10000}).reporter("spec");

  await loadScript("../test/tabs-position.test.js");

  mocha.run();
})();
