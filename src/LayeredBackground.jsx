import { FerrofluidEffect } from './ferrofluid-effect.jsx'

export function LayeredBackground() {
  return (
    <div className="fluid-background" aria-hidden="true">
      <FerrofluidEffect element="fire" preview />
      <div className="grain-layer" />
    </div>
  )
}
