import { useEffect, useState } from 'react'
import { LayeredBackground } from './LayeredBackground.jsx'
import { createCircleDesign } from './circle-design.js'

const inks = {
  Sage: '#c7d6af', Pearl: '#e8e3d6', Ember: '#efb790', Lilac: '#c8b8df',
  Crimson: '#ee8895', Gold: '#e6c776', Ice: '#a7d7ef', Teal: '#79d6c5',
  Rose: '#efb2d4', Violet: '#ab98ef', Copper: '#d69a75', Silver: '#b9c5d1',
}
const point = (radius, angle) => `${250 + radius * Math.cos(angle)},${250 + radius * Math.sin(angle)}`

function Icon({ name, ...props }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {name === 'shuffle' ? <><path d="m3 5 4 0 10 14h4m-4-4 4 4-4 3M3 19h4L17 5h4m-4-3 4 3-4 4" /></> : name === 'windows' ? <><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" fill="currentColor" stroke="none" /></> : <><path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18" /></>}
  </svg>
}

function SummoningCircle({ seed, detail, ink, miniature = false }) {
  const symmetry = 3
  const design = createCircleDesign(seed, symmetry, detail)
  const nodes = Array.from({ length: symmetry }, (_, i) => i * Math.PI * 2 / symmetry + design.rotation)
  const polygon = (radius, twist = 0, step = 1) => nodes.map(a => `M${point(radius, a + twist)} L${point(radius, a + twist + step * Math.PI * 2 / symmetry)}`).join(' ')
  function motif(shape, radius, twist, spread) {
    if (shape === 'polygon' || shape === 'star') return <path d={polygon(radius, twist, design.step)} />
    return nodes.map((a, i) => {
      const angle = a + twist
      if (shape === 'petals') return <path key={i} d={`M${point(radius * .18, angle)} Q${point(radius, angle - spread)} ${point(radius, angle)} Q${point(radius, angle + spread)} ${point(radius * .18, angle)}`} />
      if (shape === 'orbits') return <ellipse key={i} cx="250" cy="250" rx={radius} ry={radius * spread} transform={`rotate(${angle * 180 / Math.PI} 250 250)`} />
      if (shape === 'arcs') return <path key={i} d={`M${point(radius, angle - .8)} A${radius} ${radius} 0 0 1 ${point(radius, angle + .8)} M${point(radius * .55, angle)} L${point(radius * 1.08, angle)}`} />
      if (shape === 'shards') return <path key={i} d={`M${point(radius, angle)} L${point(radius * .38, angle + spread)} L${point(radius * .72, angle + Math.PI * 2 / symmetry)} Z`} />
      return <path key={i} d={`M${point(radius * .35, angle - spread)} L${point(radius, angle)} L${point(radius * .35, angle + spread)}`} />
    })
  }
  return <svg className={`summoning-circle${miniature ? ' circle-miniature' : ''}`} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style={{ color: ink }} aria-label={`Summoning circle with ${symmetry} points, seed ${seed}`} role="img">
    <g fill="none" stroke="currentColor" strokeWidth="1.1">
      {design.rings.map((ring, i) => <g key={i} strokeDasharray={ring.dash}><circle cx="250" cy="250" r={ring.radius} />{ring.double && <circle cx="250" cy="250" r={ring.radius - 4} strokeWidth=".5" />}</g>)}
      {Array.from({ length: design.ticks }, (_, i) => { const a = i * Math.PI * 2 / design.ticks + design.rotation; return <path key={i} d={`M${point(225, a)} L${point(225 + (i % 3 === 0 ? design.tickLength : 3), a)}`} strokeWidth=".7" /> })}
      {motif(design.family, design.radius, 0, design.layers[0].spread)}
      {design.layers.slice(1).map((layer, i) => <g key={i} strokeWidth=".7">{motif(layer.shape, layer.radius, layer.twist, layer.spread)}</g>)}
      {design.nodeStyle !== 'none' && nodes.map((a, i) => <g key={i} transform={`translate(${point(design.radius, a)}) rotate(${a * 180 / Math.PI})`}>
        {design.nodeStyle === 'circle' ? <><circle r="6" /><circle r="2" fill="currentColor" /></> : design.nodeStyle === 'diamond' ? <path d="M-7 0 0-5 7 0 0 5Z" /> : <path d="M-6 0H6M0-6V6" />}
      </g>)}
    </g>
  </svg>
}

export default function App() {
  const [isOpen, setIsOpen] = useState(true)
  const [maximized, setMaximized] = useState(false)
  const [seed, setSeed] = useState(1408)
  const detail = 3
  const [color, setColor] = useState('Sage')
  useEffect(() => { const onKey = e => { if (e.key === 'Escape') setIsOpen(false) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
  return (
    <main className="fluid-page" aria-label="Forest desktop">
      <LayeredBackground />
      {isOpen ? <section className={`app-window ${maximized ? 'is-maximized' : ''}`} aria-label="Summoning circle generator">
        <header className="window-bar"><div className="window-actions"><button aria-label="Minimize generator" onClick={() => setIsOpen(false)}>−</button><button aria-label={maximized ? 'Restore window' : 'Maximize window'} onClick={() => setMaximized(!maximized)}>□</button><button aria-label="Close generator" onClick={() => setIsOpen(false)}>×</button></div></header>
        <div className="app-body"><div className="circle-stage"><div className="circle-art"><SummoningCircle seed={seed} detail={detail} ink={inks[color]} /></div></div>
        <aside className="generator-controls">
          <fieldset className="control-group"><legend>Ink <span>{color}</span></legend><div className="ink-swatches">{Object.entries(inks).map(([name, value]) => <button key={name} aria-label={`${name} ink`} aria-pressed={color === name} style={{ '--ink': value }} className={color === name ? 'selected' : ''} onClick={() => setColor(name)} />)}</div></fieldset>
          <div className="seed-field"><label htmlFor="seed">SEED</label><input id="seed" type="number" min="0" max="999999" value={seed} onChange={e => setSeed(Math.max(0, Math.min(999999, Number(e.target.value) || 0)))} /></div>
          <button className="generate-button" onClick={() => setSeed(Math.floor(Math.random() * 999999))}><Icon name="shuffle" /> Generate</button>
        </aside></div>
      </section> : null}
      <nav className="desktop-taskbar" aria-label="Applications"><button className={`app-shortcut ${isOpen ? 'active' : ''}`} aria-label="Open summoning circle generator" aria-pressed={isOpen} onClick={() => setIsOpen(true)}><SummoningCircle seed={seed} detail={detail} ink={inks[color]} miniature /></button><div className="taskbar-spacer" /><button className="show-desktop" aria-label="Show desktop" onClick={() => setIsOpen(false)} /></nav>
    </main>
  )
}
