// Seeded independently of rendering, so exports and repeated seeds stay identical.
export function createCircleDesign(seed, symmetry, detail) {
  let state = (seed ^ 0x9e3779b9) >>> 0
  const random = () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
  const pick = values => values[Math.floor(random() * values.length)]
  const rotation = random() * Math.PI * 2
  const radius = 150 + random() * 24
  return {
    rotation,
    radius,
    family: pick(['star', 'petals', 'orbits', 'weave', 'shards', 'arcs']),
    step: 1 + Math.floor(random() * Math.max(1, Math.floor((symmetry - 1) / 2))),
    ticks: pick([24, 36, 48, 60, 72, 96]),
    tickLength: 3 + random() * 9,
    nodeStyle: pick(['circle', 'diamond', 'cross', 'none']),
    rings: Array.from({ length: detail + 1 }, (_, i) => ({
      radius: i === 0 ? 218 + random() * 8 : 188 - i * (12 + random() * 9),
      dash: pick(['none', 'none', '1 6', '9 5', '24 7 2 7']),
      double: random() > .5,
    })),
    layers: Array.from({ length: detail }, (_, i) => ({
      radius: radius * (1 - i * .23),
      twist: rotation + random() * Math.PI,
      spread: .18 + random() * .65,
      shape: pick(['polygon', 'petals', 'orbits', 'spokes', 'arcs']),
    })),
  }
}
