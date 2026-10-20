(() => {
  const id = crypto.randomUUID();
  const ping = () => fetch('./_native/ping', {method:'POST',body:id,cache:'no-store'}).catch(() => {});
  ping();
  setInterval(ping, 15000);
  window.addEventListener('pagehide', () => navigator.sendBeacon('./_native/close',id));
})();
