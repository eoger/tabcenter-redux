// Make sure the menu doesn't stick to the sides of the sidebar
const OVERFLOW_MENU_MARGIN = 6;

function ContextMenu(clickPosX, clickPosY, items) {
  this.clickPosX = clickPosX;
  this.clickPosY = clickPosY;
  this.items = items;
  this.rootNode = null;
}

ContextMenu.prototype = {
  show() {
    this.rootNode = document.createElement("ul");
    this.rootNode.classList = "contextmenu";
    const fragment = document.createDocumentFragment();
    for (let { label, onCommandFn } of this.items) {
      let item;
      if (label == "separator") {
        item = document.createElement("hr");
      } else {
        item = document.createElement("li");
        item.textContent = label;
        if (onCommandFn) {
          item.addEventListener("click", e => onCommandFn(e));
        }
      }
      fragment.appendChild(item);
    }
    this.rootNode.appendChild(fragment);
    document.body.appendChild(this.rootNode);
    this.positionMenu();
  },
  positionMenu() {
    const menuWidth = this.rootNode.offsetWidth + OVERFLOW_MENU_MARGIN;
    const menuHeight = this.rootNode.offsetHeight + OVERFLOW_MENU_MARGIN;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    const top = this.clickPosY + menuHeight > winHeight ?
                (winHeight - menuHeight) :
                this.clickPosY;
    const left = this.clickPosX + menuWidth > winWidth ?
                 (winWidth - menuWidth) :
                 this.clickPosX;

    this.rootNode.style.top = `${top}px`;
    this.rootNode.style.left = `${left}px`;
  },
  hide() {
    if (this.rootNode) {
      this.rootNode.remove();
    }
  }
};

module.exports = ContextMenu;
