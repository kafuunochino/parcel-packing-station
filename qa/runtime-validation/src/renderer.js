export function render(ctx, size, state, sidebar) {
  const { width, height, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f5f0e6'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#173e36'; ctx.font = 'bold 23px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Canvas2D runtime proof', 22, 75);
  ctx.font = '16px sans-serif';
  ctx.fillText('Tap anywhere: ' + state.taps, 22, 110);
  ctx.fillText('Runtime proof, not platform certification', 22, 140);
  ctx.fillText(Math.round(width) + ' × ' + Math.round(height) + ' · DPR ' + dpr, 22, 169);
  const point = state.point || { x: width / 2, y: height / 2 };
  ctx.fillStyle = '#eb7756'; ctx.fillRect(point.x - 20, point.y - 20, 40, 40);
  if (sidebar?.available) {
    ctx.fillStyle = '#173e36'; ctx.fillRect(22, height - 110, width - 44, 60);
    ctx.fillStyle = '#ffffff'; ctx.font = '15px sans-serif';
    ctx.fillText(sidebar.pending ? 'Opening sidebar…' : 'Open Douyin sidebar', 35, height - 75);
    ctx.fillStyle = '#173e36'; ctx.font = '13px sans-serif';
    ctx.fillText(sidebar.error ? 'Sidebar unavailable. Try again.' : sidebar.enteredFromSidebar ? 'Sidebar return received' : 'Platform-only navigation test', 22, height - 25);
  }
}
