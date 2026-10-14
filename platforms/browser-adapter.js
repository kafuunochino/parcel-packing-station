import {createMockRewards} from '../src/rewards.js';
// DOM access is isolated to this browser adapter. Not shipped in the tt build.
export function createBrowserPlatform(canvas, host = window, audioPaths = {}) {
  const listeners = { pointer: new Set(), resize: new Set(), pause: new Set(), resume: new Set() };
  const removers = [];
  const rewards=createMockRewards(typeof host.setTimeout==='function'?{timers:{setTimeout:(fn,ms)=>host.setTimeout(fn,ms),clearTimeout:id=>host.clearTimeout(id)}}:{});
  const emit = (name, value) => listeners[name].forEach(fn => fn(value));
  const subscribe = name => fn => { listeners[name].add(fn); return () => listeners[name].delete(fn); };
  const listen = (target, name, fn) => { target.addEventListener(name, fn); removers.push(() => target.removeEventListener(name, fn)); };
  let size;const activePointers=new Map();
  function cancelPointer(id){const p=activePointers.get(id);if(p){activePointers.delete(id);emit('pointer',{...p,type:'cancel'});}}
  function cancelPointers(){[...activePointers.keys()].forEach(cancelPointer);}
  function resize() {
    cancelPointers();
    const rect = canvas.getBoundingClientRect();
    const style = typeof host.getComputedStyle === 'function' ? host.getComputedStyle(host.document.documentElement) : null;
    const inset = name => style ? Math.max(0, parseFloat(style.getPropertyValue('--safe-' + name)) || 0) : 0;
    size = { width: rect.width, height: rect.height, dpr: Math.min(host.devicePixelRatio || 1, 3), safeTop: inset('top'), safeBottom: inset('bottom'), safeLeft: inset('left'), safeRight: inset('right') };
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    emit('resize', { ...size });
  }
  resize();
  listen(host, 'resize', resize);
  for (const [event, type] of [['pointerdown','down'],['pointermove','move'],['pointerup','up'],['pointercancel','cancel']]) {
    listen(canvas, event, e => {
      if (type === 'down') {try {canvas.setPointerCapture?.(e.pointerId);}catch {_captureUnavailable();}}
      const rect = canvas.getBoundingClientRect();
      const pointer={type,x:(e.clientX-rect.left)*size.width/rect.width,y:(e.clientY-rect.top)*size.height/rect.height,id:e.pointerId};if(type==='down'||activePointers.has(e.pointerId))activePointers.set(e.pointerId,pointer);emit('pointer',pointer);if(type==='up'||type==='cancel')activePointers.delete(e.pointerId);
    });
  }
  function _captureUnavailable(){/* Pointer input still works when capture is unsupported. */}
  listen(canvas,'lostpointercapture',e=>cancelPointer(e.pointerId));
  listen(host,'blur',cancelPointers);
  let muted = false;
  const sounds = new Map();
  const audio = {
    play(name) {
      if (muted || !audioPaths[name]) return;
      try {
        let sound = sounds.get(name);
        if (!sound) { sound = new host.Audio(audioPaths[name]); sounds.set(name, sound); }
        sound.currentTime = 0;
        const pending = sound.play();
        if (pending?.catch) pending.catch(() => {});
      } catch { /* Audio failure must not block play. */ }
    },
    setMuted(value) { muted = Boolean(value); if (muted) sounds.forEach(sound => sound.pause()); }
  };
  listen(host, 'pagehide', () => { cancelPointers(); sounds.forEach(sound => sound.pause()); emit('pause'); });
  listen(host, 'pageshow', event => { if (event.persisted) { resize(); emit('resume'); } });
  listen(host.document, 'visibilitychange', () => {
    if (host.document.hidden) { cancelPointers(); sounds.forEach(sound => sound.pause()); emit('pause'); }
    else { resize(); emit('resume'); }
  });
  return {
    canvas, rewards, getSize: () => ({ ...size }),
    onPointer: subscribe('pointer'), onResize: subscribe('resize'), onPause: subscribe('pause'), onResume: subscribe('resume'),
    requestFrame: fn => host.requestAnimationFrame(fn), cancelFrame: id => host.cancelAnimationFrame(id),
    storage: { getItem: key => host.localStorage.getItem(key), setItem: (key, value) => host.localStorage.setItem(key, value) },
    audio,
    destroy() { cancelPointers();rewards.destroy(); removers.forEach(fn => fn()); sounds.forEach(sound => sound.pause()); Object.values(listeners).forEach(set => set.clear()); }
  };
}
