export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

export function qs<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found as T;
}
