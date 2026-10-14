import { initialState, reduce } from './core.js';
import { render } from './renderer.js';
export function startGame(platform) {
  let saved = null;
  try { saved = platform.storage.getItem('runtime-spike.v1'); } catch { /* Continue without persistence. */ }
  let state = initialState(saved), frame = null, paused = false, destroyed = false;
  const ctx = platform.canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D is unavailable');
  function draw() {
    frame = null;
    if (paused || destroyed) return;
    render(ctx, platform.getSize(), state, platform.sidebar?.getState());
    frame = platform.requestFrame(draw);
  }
  function pause() { paused = true; if (frame !== null) platform.cancelFrame(frame); frame = null; }
  function resume() { if (destroyed || !paused) return; paused = false; draw(); }
  const cleanups = [
    platform.onPointer(event => {
      if (paused || destroyed) return;
      const size = platform.getSize();
      if (event.type === 'down' && platform.sidebar?.getState().available && event.x >= 22 && event.x <= size.width - 22 && event.y >= size.height - 110 && event.y <= size.height - 50) { platform.sidebar.navigate(); return; }
      const next = reduce(state, event);
      if (next === state) return;
      state = next;
      try { platform.storage.setItem('runtime-spike.v1', String(state.taps)); } catch { /* Persistence is best effort. */ }
      platform.audio.play('tap');
    }),
    platform.onPause(pause), platform.onResume(resume),
    platform.onResize(() => { if (!paused && !destroyed) render(ctx, platform.getSize(), state, platform.sidebar?.getState()); })
  ];
  draw();
  return {
    getState: () => JSON.parse(JSON.stringify(state)), // Test helper; not required by production platform contract.
    destroy() { if (destroyed) return; destroyed = true; pause(); cleanups.forEach(fn => fn()); }
  };
}
