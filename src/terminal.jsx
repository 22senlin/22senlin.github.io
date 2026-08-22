const NOTE = {
  en: 'Heaven brings forth innumerable things to nurture man. Man has nothing good with which to recompense Heaven. Kill. Kill. Kill. Kill. Kill. Kill. Kill.',
  zh: '天生萬物以養人，人無一善以報天，殺殺殺殺殺殺殺',
}

export function Terminal({ lang = 'en', className = 'terminal-goals' }) {
  return (
    <div className={className}>
      {/* Terminal Window Header Bar */}
      <div className="terminal-header">
        <div className="terminal-buttons">
          <span className="btn close" />
          <span className="btn minimize" />
          <span className="btn maximize" />
        </div>
      </div>

      {/* Terminal Content Body */}
      <div className="terminal-body">
        {/* Neofetch Prompt Line */}
        <div className="terminal-prompt-line">
          <span className="prompt-user">
            <span className="user-name">edot</span><span className="at-symbol">@</span><span className="host-name">raspberrypi</span>
          </span>
          <span className="prompt-colon">:</span>
          <span className="prompt-path">~</span>
          <span className="prompt-symbol">$</span>
          <span className="prompt-cmd">neofetch</span>
        </div>

        {/* Neofetch Display */}
        <div className="fastfetch-display">
          {/* Left Column: Debian Swirl ASCII Logo */}
          <div className="fastfetch-ascii debian-ascii">
            <pre className="ascii-art">
{`       _,met$$$$$gg.
    ,g$$$$$$$$$$$$$$$P.
  ,g$$P"     """Y$$.".
 ,$$P'              \`$$$.
',$$P       ,ggs.     \`$$b:
\`d$$'     ,$P"'   .    $$$
 $$P      d$'     ,    $$P
 $$:      $$.   -    ,d$$'
 $$;      Y$b._   _,d$P'
 Y$$.    \`.\`"Y$$$$P"'
 \`$$b      "-.__
  \`Y$$
   \`Y$$.
     \`$$b.
       \`Y$$b.
          \`"Y$b._
              \`"""`}
            </pre>
          </div>

          {/* Right Column: Neofetch Spec Sheet */}
          <div className="fastfetch-info">
            <div className="info-user">
              <span className="user-name">edot</span><span className="at-symbol">@</span><span className="host-name">raspberrypi</span>
            </div>
            <div className="info-dash">-------------------</div>
            <div className="info-row">
              <span className="info-key">OS</span>: Debian GNU/Linux 12 (bookworm) aarch64
            </div>
            <div className="info-row">
              <span className="info-key">Host</span>: Raspberry Pi 5 Model B Rev 1.0
            </div>
            <div className="info-row">
              <span className="info-key">Kernel</span>: 6.12.47+rpt-rpi-2712
            </div>
            <div className="info-row">
              <span className="info-key">Uptime</span>: 3 days, 22 hours, 59 mins
            </div>
            <div className="info-row">
              <span className="info-key">Packages</span>: 1941 (dpkg)
            </div>
            <div className="info-row">
              <span className="info-key">Shell</span>: bash 5.2.15
            </div>
            <div className="info-row">
              <span className="info-key">Terminal</span>: /dev/pts/0
            </div>
            <div className="info-row">
              <span className="info-key">CPU</span>: (4) @ 2.400GHz
            </div>
            <div className="info-row">
              <span className="info-key">Memory</span>: 973MiB / 4049MiB
            </div>
            <div className="info-row info-note">
              <span className="info-key">Note</span>: {NOTE[lang] || NOTE.en}
            </div>

            {/* Terminal Swatches */}
            <div className="color-swatches">
              <span className="swatch c-dark">███</span>
              <span className="swatch c-red">███</span>
              <span className="swatch c-green">███</span>
              <span className="swatch c-yellow">███</span>
              <span className="swatch c-blue">███</span>
              <span className="swatch c-magenta">███</span>
              <span className="swatch c-cyan">███</span>
              <span className="swatch c-white">███</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
