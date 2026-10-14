# Canvas 游戏宿主接口

游戏入口：`import {startGame} from './src/game.js'`，执行 `startGame(platform)` 返回 `{destroy()}`。核心与渲染不读取 DOM、浏览器全局或 `tt`；只有适配器依赖宿主。

```js
platform = {
  canvas, // getContext('2d')；适配器设置后备像素尺寸
  getSize: () => ({ width, height, dpr, safeTop, safeBottom }), // 逻辑像素
  onPointer: handler => unsubscribe,
  onResize: handler => unsubscribe,
  onPause: handler => unsubscribe,
  onResume: handler => unsubscribe,
  requestFrame: handler => frameId,
  cancelFrame: frameId => {},
  storage: { getItem: key => stringOrNull, setItem: (key, string) => {} },
  audio: { play: name => {}, setMuted: boolean => {} }
};
// 指针事件：{type:'down'|'move'|'up'|'cancel', x, y, id}
// 音效名：tap、place、squeeze、error、win
```

- 适配器设置 `canvas.width = logicalWidth * dpr` 与对应高度，渲染器每帧设置 DPR 变换。
- 游戏将画面缩放至 390×800 手机逻辑构图或 1100×760 桌面逻辑构图，输入逆变换到同一坐标空间。保持纵横比，不产生横向滚动。
- `onPause` 停止帧与拖动并保存；`onResume` 重新绘制。`destroy` 可重复调用，解除游戏订阅并取消帧。
- 存储异常由游戏捕获，不阻止游玩；音频异常由适配器吸收。没有存储时不承诺进度持久化。
- 模拟平台测试使用这个真实接口并操作实际 Canvas 按钮坐标，没有绕过规则写胜利状态。
- `platforms/tt.js` 是候选适配，不代表已通过抖音开发者工具或真实设备；微信适配尚未编写。

## 可选侧边栏接口

`platform.sidebar` 由 `tt` 适配器提供，浏览器省略。接口为 `getState()`、`subscribe(fn)`、`navigate(): Promise<boolean>`、`destroy()`。状态含 `available`、`checked`、`pending`、`enteredFromSidebar` 与 `error`。适配器持有生命周期，游戏只订阅状态与明确点击时导航。

`safeTop`/`safeBottom` 为可选逻辑像素留白。tt 端保守预留状态栏高度加 48px 顶部菜单区与 12px 底部；浏览器不额外留白。渲染与触摸同用该坐标变换。
