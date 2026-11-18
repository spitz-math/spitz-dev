// All four workspaces share the same navigation and destination order.
const studioRoot = new URL('.', document.currentScript.src)
class StudioNav extends HTMLElement {
  connectedCallback() {
    const tools = this.querySelector('.nowtools')
    const dashboard = ['now', 'board'].includes(this.dataset.page)
    const taskLink = hash => dashboard ? '#' + hash : new URL('index.html#' + hash, studioRoot).href
    const destinations = [
      ['now', 'Now', taskLink('now')],
      ['board', 'Board', taskLink('board')],
      ['art', 'Art', new URL('approve/index.html', studioRoot).href],
      ['void', 'Void', new URL('void/index.html', studioRoot).href]
    ]
    this.innerHTML = `<header class="studio-bar"><div class="studio-inner">
      <a class="studio-brand" href="${taskLink('now')}" aria-label="spitz.dev home"><img src="${new URL('burger_line_192.png', studioRoot).href}" alt=""><span>spitz<b>.dev</b></span></a>
      <nav class="studio-tabs" aria-label="Main navigation">${destinations.map(([id, name, href]) =>
        `<a class="studio-tab" data-dest="${id}" href="${href}"><i aria-hidden="true"></i><span>${name}</span></a>`).join('')}</nav>
      </div></header>`
    if (tools) this.querySelector('.studio-inner').append(tools)
    this.setPage(this.dataset.page)
  }
  setPage(page) {
    this.dataset.page = page
    this.querySelectorAll('[data-dest]').forEach(a => {
      if (a.dataset.dest === page) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
  }
}
customElements.define('studio-nav', StudioNav)
