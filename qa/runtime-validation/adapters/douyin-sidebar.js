// Functional, optional platform feature; never claims upload/review compliance.
// Instantiate synchronously in game.js so the first onShow event is not missed.
export function createDouyinSidebar(tt) {
  let state = { available: false, enteredFromSidebar: false, pending: false, error: null };
  let destroyed = false;
  const listeners = new Set();
  const update = patch => { if (destroyed) return; state = { ...state, ...patch }; listeners.forEach(fn => fn({ ...state })); };
  const onShow = options => update({ enteredFromSidebar: options?.launch_from === 'homepage' && options?.location === 'sidebar_card' });
  if (typeof tt.onShow === 'function') tt.onShow(onShow);
  if (typeof tt.checkScene === 'function' && typeof tt.navigateToScene === 'function') {
    try {
      tt.checkScene({ scene: 'sidebar', success: result => update({ available: result.isExist === true, error: null }), fail: result => update({ available: false, error: result?.errMsg || 'Sidebar capability check failed' }) });
    } catch { update({ available: false, error: 'Sidebar capability check failed' }); }
  }
  return {
    getState: () => ({ ...state }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    navigate() {
      if (destroyed || !state.available || state.pending) return Promise.resolve(false);
      update({ pending: true, error: null });
      return new Promise(resolve => {
        try {
          tt.navigateToScene({
            scene: 'sidebar',
            success: () => { update({ pending: false }); resolve(true); },
            fail: result => { update({ pending: false, error: result?.errMsg || 'Sidebar navigation failed' }); resolve(false); }
          });
        } catch { update({ pending: false, error: 'Sidebar navigation failed' }); resolve(false); }
      });
    },
    destroy() { destroyed = true; if (typeof tt.offShow === 'function') tt.offShow(onShow); listeners.clear(); }
  };
}
