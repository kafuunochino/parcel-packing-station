export function initialState(saved) {
  const parsed = Number(saved);
  return { taps: Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0, point: null };
}
export function reduce(state, event) {
  if (event.type !== 'down' || !Number.isFinite(event.x) || !Number.isFinite(event.y)) return state;
  return { taps: state.taps + 1, point: { x: event.x, y: event.y } };
}
