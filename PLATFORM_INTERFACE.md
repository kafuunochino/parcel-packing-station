# Canvas 游戏宿主接口

`startGame(platform)` 返回 `{destroy(), getSnapshot()}`。规则和渲染不读取DOM、window或tt；仅宿主适配器依赖平台。

```js
platform = {
  canvas,
  getSize: () => ({ width, height, dpr, safeTop, safeBottom, safeLeft, safeRight }),
  onPointer: handler => unsubscribe,
  onResize: handler => unsubscribe,
  onPause: handler => unsubscribe,
  onResume: handler => unsubscribe,
  requestFrame: handler => frameId,
  cancelFrame: frameId => {},
  storage: { getItem: key => stringOrNull, setItem: (key, string) => {} },
  audio: { play: name => {}, setMuted: boolean => {} },
  sidebar // optional: getState, subscribe, navigate, destroy
};
// Pointer: {type:'down'|'move'|'up'|'cancel', x, y, id}
```

## 手机尺寸与输入

- width/height、安全区和指针坐标均为CSS逻辑像素；dpr只用于后备像素和绘制精度。
- Canvas铺满宿主。安全区内部工位宽度不超过480px；宽屏居中并延展仓库背景。渲染和输入只做相同x/y偏移，不缩小触点。
- 浏览器读取CSS自定义属性中的env(safe-area-inset-*)；tt读取safeArea和可用时的getMenuButtonBoundingClientRect。能力缺失时顶部保守回退到状态栏+48px，底部至少12px。
- 320×568及当前覆盖的安全区组合中，所有按钮/包裹卡至少44×44px，最大6×6装箱格每格也至少44px。
- 可用宽度小于304px或高度小于482px时显示竖屏/放大窗口提示，保留当前状态，而不是压缩按钮。桌面可改变窗口尺寸后继续。
- 货架一行三件，分页不改变选中包裹或箱内状态。所有菜单和教程仍在Canvas内。

## 生命周期和状态

- onPause取消拖动与帧并保存；onResume重新布局。resize取消旧手势并失效旧命中区。destroy可重复调用，释放订阅。
- 开关弹层会立即使旧按钮失效，阻止同一帧的穿透操作。第二个触点不能劫持当前拖动。
- 存储异常不阻止游玩；音频异常由适配器吸收。本地存储不可用时不承诺持久化。
- getSnapshot返回JSON深拷贝，含screen/modal/level/state、layout与物理屏幕hitTargets，不提供动作注入。浏览器暴露冻结的window.__parcelGame对象；tt候选没有window依赖。

## 可选侧边栏

platform.sidebar由tt适配器拥有，游戏只订阅状态，在玩家明确点击时调用navigate。状态包含available、checked、pending、enteredFromSidebar、error。只有最新onShow来源匹配时才确认复访，不发奖励，不因导航success伪造返回。

接口和模拟测试不代表抖音官方工具、手机或微信兼容性验证。
