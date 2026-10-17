import {createDouyinSidebar} from './douyin-sidebar.js';
import {createDisabledRewards} from '../src/rewards.js';
// No browser globals. tt and the frame scheduler are explicitly injected.
export function createTTPlatform(api, scheduler, audioPaths = {}) {
  const sidebar = createDouyinSidebar(api);
  const rewards=createDisabledRewards();
  const canvas = api.createCanvas(); // Exactly one on-screen canvas.
  const listeners = { pointer: new Set(), resize: new Set(), pause: new Set(), resume: new Set() };
  const removers = [];
  const sounds = new Map();
  const emit = (name, value) => listeners[name].forEach(fn => fn(value));
  const subscribe = name => fn => { listeners[name].add(fn); return () => listeners[name].delete(fn); };
  const bind = (on, off, fn) => { if (typeof api[on] === 'function') { api[on](fn); removers.push(() => { if (typeof api[off] === 'function') api[off](fn); }); } };
  let size;
  function resize(event) {
    const info = api.getSystemInfoSync();
    const changed = event && (event.size || event) || {};
    const positive = n => Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0;
    const width = positive(changed.windowWidth) || positive(info.screenWidth) || positive(info.windowWidth);
    const height = positive(changed.windowHeight) || positive(info.screenHeight) || positive(info.windowHeight);
    const safe = info.safeArea || {}, bounded = (n,max) => Math.max(0,Math.min(Number(n)||0,max));
    let menuBottom = 0;
    try {
      const menu = typeof api.getMenuButtonLayout === 'function' ? api.getMenuButtonLayout() :
        typeof api.getMenuButtonBoundingClientRect === 'function' ? api.getMenuButtonBoundingClientRect() : null;
      if (menu && Number.isFinite(menu.bottom) && menu.bottom > 0) menuBottom = menu.bottom + 6;
    } catch (_error) { /* Optional host menu capability. */ }
    const next = { width, height, dpr: Math.min(positive(info.pixelRatio) || 1, 3),
      safeTop: bounded(Math.max(Number(safe.top)||0,menuBottom || ((Number(info.statusBarHeight)||0)+48)),height/3),
      safeBottom: bounded(Math.max(12,Number.isFinite(safe.bottom)?height-safe.bottom:0),height/3),
      safeLeft: bounded(safe.left,width/4),
      safeRight: bounded(Number.isFinite(safe.right)?width-safe.right:0,width/4) };
    if (!(next.width > 0 && next.height > 0)) throw new Error('Platform viewport dimensions are missing');
    if (size && next.width === size.width && next.height === size.height && next.dpr === size.dpr && next.safeTop === size.safeTop && next.safeBottom === size.safeBottom && next.safeLeft === size.safeLeft && next.safeRight === size.safeRight) return;
    size = next;
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    emit('resize', { ...size });
  }
  resize();
  for (const [suffix, type] of [['Start','down'],['Move','move'],['End','up'],['Cancel','cancel']]) {
    bind('onTouch' + suffix, 'offTouch' + suffix, event => {
      const touches = (event.changedTouches && event.changedTouches.length) ? event.changedTouches : event.touches || [];
      touches.forEach(touch => emit('pointer', { type, x: touch.clientX, y: touch.clientY, id: touch.identifier }));
    });
  }
  let muted = false, audioPaused = false, audioDestroyed = false;
  const safeAudioCall = (sound, method, ...args) => { try { if (typeof sound[method] === 'function') sound[method](...args); } catch (_) { /* A broken optional audio method must not interrupt game lifecycle. */ } };
  const stopAudio = () => sounds.forEach(sound => safeAudioCall(sound, 'pause'));
  bind('onHide', 'offHide', () => { audioPaused = true; stopAudio(); emit('pause'); });
  bind('onShow', 'offShow', () => { audioPaused = false; resize(); emit('resume'); });
  // Touch coordinates stay logical pixels; resize invalidates the game gesture.
  bind('onWindowResize', 'offWindowResize', resize);
  return {
    canvas, sidebar, rewards, getSize: () => ({ ...size }),
    onPointer: subscribe('pointer'), onResize: subscribe('resize'), onPause: subscribe('pause'), onResume: subscribe('resume'),
    requestFrame: fn => scheduler.requestAnimationFrame(fn), cancelFrame: id => scheduler.cancelAnimationFrame(id),
    storage: {
      getItem(key) { const value = api.getStorageSync(key); return value === undefined || value === null || value === '' ? null : String(value); },
      setItem(key, value) { api.setStorageSync(key, String(value)); }
    },
    audio: {
      play(name) {
        if (muted || audioPaused || audioDestroyed || !audioPaths[name] || typeof api.createInnerAudioContext !== 'function') return;
        try {
          let sound = sounds.get(name);
          if (!sound) { sound = api.createInnerAudioContext(); sound.src = audioPaths[name]; if(typeof sound.onError==='function')sound.onError(() => {}); sounds.set(name, sound); }
          safeAudioCall(sound, 'seek', 0); safeAudioCall(sound, 'play');
        } catch (_error) { /* Audio failure must not block play. */ }
      },
      setMuted(value) { muted = Boolean(value); if (muted) stopAudio(); }
    },
    destroy() { if (audioDestroyed) return; audioDestroyed = true; stopAudio(); rewards.destroy(); sidebar.destroy(); removers.forEach(fn => fn()); sounds.forEach(sound => safeAudioCall(sound, 'destroy')); sounds.clear(); Object.values(listeners).forEach(set => set.clear()); }
  };
}
