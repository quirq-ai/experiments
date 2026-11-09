// Boot. Stations register themselves in script order, which is the tour order.
(() => {
  const start = () => globalThis.QL.shell.start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
