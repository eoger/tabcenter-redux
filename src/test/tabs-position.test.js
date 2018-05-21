/* eslint-env mocha */
/* global chai, tabCenter */

suite("tabs positions and indexes", () => {
  const {assert} = chai;

  function assertDOMOrderCorrect(ffTabs) {
    const ffTabsIds = ffTabs.filter(t => !t.hidden).map(t => t.id);
    const domTabsIds = [...document.querySelectorAll(".tab")]
      .map(e => parseInt(e.getAttribute("data-tab-id")));
    assert.deepEqual(domTabsIds, ffTabsIds, "Order of tabs in the DOM is correct.");
  }

  function assertIndexesCorrect(ffTabs) {
    const tcTabs = tabCenter._tabList._tabs;
    assert.equal(tcTabs.size, ffTabs.length, "TabList number of tabs is correct.");

    for (const ffTab of ffTabs) {
      const tcTab = tcTabs.get(ffTab.id);
      assert.ok(tcTab, "found the TC tab");
      assert.equal(tcTab.index, ffTab.index, "Tab index is correct.");
    }
  }

  async function assertOrderAndIndexes() {
    const ffTabs = await browser.tabs.query({windowId: ourWindowId});
    assertDOMOrderCorrect(ffTabs);
    assertIndexesCorrect(ffTabs);
  }

  let ourWindowId;
  suiteSetup(async () => {
    const ourWindow = await browser.windows.getCurrent();
    ourWindowId = ourWindow.id;
  });

  async function cleanState() {
    const windows = await browser.windows.getAll();
    for (const win of windows) {
      if (win.id !== ourWindowId) {
        await browser.windows.remove(win.id);
      }
    }
    const tabs = (await browser.tabs.query({windowId: ourWindowId})).map(t => t.id);
    await browser.tabs.create({windowId: ourWindowId});
    await browser.tabs.remove(tabs);
  }

  setup(() => cleanState());
  suiteTeardown(() => cleanState());

  test("sanity check", async () => {
    const ffTabs = await browser.tabs.query({windowId: ourWindowId});
    assertDOMOrderCorrect(ffTabs);
    assertIndexesCorrect(ffTabs);
  });
  test("insertions/deletions", async () => {
    await browser.tabs.create({});
    const {id: tabID1} = await browser.tabs.create({});
    await browser.tabs.create({});
    await assertOrderAndIndexes();
    await browser.tabs.remove(tabID1);
    await assertOrderAndIndexes();
    await browser.tabs.create({index: 1});
    await assertOrderAndIndexes();
    await browser.tabs.create({});
    await assertOrderAndIndexes();
  });
  test("moves", async () => {
    await browser.tabs.create({});
    const {id: tabID1} = await browser.tabs.create({});
    await browser.tabs.create({});
    await browser.tabs.create({});
    await browser.tabs.create({});
    await browser.tabs.move(tabID1, {index: 3});
    await assertOrderAndIndexes();
    await browser.tabs.move(tabID1, {index: -1});
    await assertOrderAndIndexes();
    await browser.tabs.move(tabID1, {index: 0});
    await assertOrderAndIndexes();
  });
  test("attach from other window", async () => {
    await browser.tabs.create({});
    await browser.tabs.create({});
    await browser.tabs.create({});
    const {id: otherWindowId} = await browser.windows.create();
    await assertOrderAndIndexes();
    const {id: otherTabId1} = (await browser.tabs.query({windowId: otherWindowId}))[0];
    const {id: otherTabId2} = await browser.tabs.create({windowId: otherWindowId});
    const {id: otherTabId3} = await browser.tabs.create({windowId: otherWindowId});

    await browser.tabs.move(otherTabId1, {windowId: ourWindowId, index: -1});
    await assertOrderAndIndexes();
    await browser.tabs.move(otherTabId2, {windowId: ourWindowId, index: 0});
    await assertOrderAndIndexes();
    await browser.tabs.move(otherTabId3, {windowId: ourWindowId, index: 2});
    await assertOrderAndIndexes();
  });
  test("detach to other window", async () => {
    const {id: tabID1} = await browser.tabs.create({});
    await browser.tabs.create({});
    const {id: tabID3} = await browser.tabs.create({});
    await browser.tabs.create({});
    const {id: otherWindowId} = await browser.windows.create({tabId: tabID3});
    await assertOrderAndIndexes();
    await browser.tabs.move(tabID1, {windowId: otherWindowId, index: -1});
    await assertOrderAndIndexes();
  });
  test("hidding/un-hidding", async () => {
    const {id: tabID1} = await browser.tabs.create({});
    await browser.tabs.hide(tabID1);
    const {id: tabID2} = await browser.tabs.create({});
    const {id: tabID3} = await browser.tabs.create({});
    await assertOrderAndIndexes();
    await browser.tabs.move(tabID3, {index: 0});
    await assertOrderAndIndexes();
    await browser.tabs.hide(tabID2);
    await assertOrderAndIndexes();
    await browser.tabs.show(tabID1);
    await assertOrderAndIndexes();
  });
  test("hidden + move (#347)", async () => {
    const {id: tabID1} = await browser.tabs.create({});
    const {id: tabID2} = await browser.tabs.create({});
    const {id: tabID3} = await browser.tabs.create({});
    await browser.tabs.hide(tabID1);
    await browser.tabs.hide(tabID2);
    await browser.tabs.hide(tabID3);
    await assertOrderAndIndexes();
    await browser.tabs.move(tabID1, {index: 2});
    await browser.tabs.move(tabID3, {index: 0});
    await assertOrderAndIndexes();
  });
});
