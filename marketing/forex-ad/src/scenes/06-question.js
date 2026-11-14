/* S06 "the question" (14-16 s): the camera pushes in on the NOW point left by
 * S05 while corner brackets close around it one step per beat. From 15.5 the
 * scene is plain void: the visual gap before the drop at 16.0.
 *
 * The price stage is the one S05 builds (AD.fanStage in 05-fan.js); this scene
 * starts from stage.rest, the exact state S05 ends in.
 */
AD.defineScene('question', {
  css: `
    ${AD.fanStage ? AD.fanStage.css('question') : ''}
    .scene--question .q-mark { color: var(--accent); }
  `,
  build(root, ctx) {
    const c = ctx.content
    if (!AD.fanStage) throw new Error('06-question.js needs the price stage from 05-fan.js (AD.fanStage)')
    // Everything lives in one wrapper so the cut to void at 15.5 is a single switch.
    const wrap = AD.el('div', 'fill', root)
    const stage = AD.fanStage(wrap, ctx)
    const geo = stage.geo

    const brackets = AD.kit.brackets(wrap)

    // Centred above the reticle: one line in 16:9, two in the portrait formats.
    const lines = ctx.landscape ? ['SO WHAT CAN YOU KNOW?'] : ['SO WHAT CAN', 'YOU KNOW?']
    const half = Math.min(geo.focus.x - c.x, c.x + c.w - geo.focus.x)
    const head = AD.kit.headline(wrap, lines, { tier: 'display', x: geo.focus.x - half, y: c.y, w: half * 2, align: 'center' })
    // Give the question mark its own span so it can blink.
    const last = head.lines[head.lines.length - 1].inner
    last.textContent = last.textContent.slice(0, -1)
    const mark = AD.el('span', 'q-mark', last, '?')

    return { wrap, stage, geo, brackets, head, mark }
  },
  render(t, ctx, s) {
    const { ease, prog, lerp } = AD
    const geo = s.geo

    // 15.5-16.0: plain void (the chrome scene keeps the bug, clock and risk band).
    const on = t < 1.5
    s.wrap.style.display = on ? 'block' : 'none'
    if (!on) return

    // Push-in on the NOW point, accelerating gently. 16:9 first re-centres it under
    // the headline with one servo pan (15 frames, then holds).
    const push = prog(t, 0, 1.5, ease.quad.in)
    const pan = prog(t, 0, 0.5, ease.quint.inOut)
    const cx = lerp(geo.nowX, geo.focus.x, pan)
    const cy = lerp(geo.level, geo.focus.y, pan)

    // Brackets: one step per beat, each a 4-frame snap.
    const sizes = [[geo.frames[0][0] * 1.3, geo.frames[0][1] * 1.3], ...geo.frames]
    let w = sizes[0][0]
    let h = sizes[0][1]
    for (let i = 1; i < sizes.length; i++) {
      const e = prog(t, (i - 1) * 0.5, 4 / 30, ease.expo.out)
      w = lerp(w, sizes[i][0], e)
      h = lerp(h, sizes[i][1], e)
    }
    const first = prog(t, 0, 4 / 30, ease.expo.out)
    s.brackets.set({ x: cx + 0.5 - w / 2, y: cy + 1 - h / 2, w, h, len: 30, opacity: prog(t, 0, 3 / 30) })

    s.stage.draw({
      zoom: 1 + 0.4 * push,
      cx,
      cy,
      histAlpha: lerp(1, 0.3, prog(t, 0, 1.5)),
      // The hairline pulls back inside the bracket frame as it closes.
      hairTop: lerp(s.stage.rest.hairTop, cy - h / 2 - 14, first),
    })

    s.head.show(t, { at: -1 / 30, each: 0.1 })
    // The question mark blinks once on the beat at 15.0.
    s.mark.style.visibility = t >= 1 && t < 1.09 ? 'hidden' : 'visible' // three frames
  },
})
