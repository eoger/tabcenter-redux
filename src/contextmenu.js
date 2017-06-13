function ContextMenu(posX, posY, items) {
  this.posX = posX;
  this.posY = posY;
  this.items = items;
  this.rootNode = null;
}

ContextMenu.prototype = {
  show() {
    this.rootNode = document.createElement("ul");
    this.rootNode.classList = "contextmenu";
    this.rootNode.style.left = `${this.posX}px`;
    this.rootNode.style.top = `${this.posY}px`;
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
  },
  hide() {
    if (this.rootNode) {
      this.rootNode.remove();
    }
  }
};

module.exports = ContextMenu;
