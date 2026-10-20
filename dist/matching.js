// The gallery contains fixed, public portrait descriptors. Visitor descriptors
// are kept in memory only and are never stored or sent over the network.
export function euclideanDistance(a, b) {
  if (!a || !b || a.length !== 128 || b.length !== 128) throw new Error('Descritor facial inválido.');
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('Descritor facial inválido.');
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export function rankPortraits(descriptor, gallery, limit = 3) {
  return gallery.map(person => ({ person, distance: euclideanDistance(descriptor, person.descriptor) }))
    .sort((a, b) => a.distance - b.distance || a.person.id.localeCompare(b.person.id))
    .slice(0, limit);
}
