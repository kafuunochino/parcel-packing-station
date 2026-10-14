# 快递收纳站 · 抖音测试候选

2026-10-14。本文件记录源码构建候选，不代表已经上传、通过审核或通过真机体验。

## 身份与产物

- 控制台核实的应用：快递收纳站。
- 非敏感 AppID：`tt8a23fc9e145a412a02`。
- 候选版本：`0.1.0`。
- 规范配置：`config/douyin.json`。可用环境变量 `DOUYIN_APP_ID` 做明确测试覆盖；不保存凭证或联系方式。
- 构建：`npm run build`。
- 上传任务应使用目录：`dist/douyin/`，不是根目录或浏览器 HTML。
- 文件：`game.js`、`game.json`、`project.config.json`、`assets/tap.wav`、`assets/place.wav`、`assets/squeeze.wav`、`assets/error.wav`、`assets/win.wav`。
- 精确逐文件 SHA-256：`artifacts/douyin-candidate-manifest.json`（本次冻结副本），以及每次构建生成的 `dist/douyin-build-manifest.json`。
- 登录、预检、上传由获授权的独立平台操作执行；本构建脚本不会联网或上传。

## 已实现的必接侧边栏路径

1. `createTTPlatform` 开始时同步创建 sidebar adapter，在 Canvas 和游戏启动前监听 `tt.onShow`。
2. 同时检查 `tt.checkScene` 与 `tt.navigateToScene` 是否存在，并通过实际 `checkScene({scene:'sidebar'})` 判断支持。未支持、查询失败或尚未确认时不显示入口。
3. 支持后主画面显示 Canvas「侧边栏复访」按钮。点击只打开说明，不产生外部导航。
4. 玩家明确点击「打开侧边栏」后关闭说明、保存进度，并调用实际 `tt.navigateToScene({scene:'sidebar'})`。
5. `pending` 防重入。失败/取消恢复可玩状态。导航成功只表示 API 成功，不表示玩家已经返回。
6. 每一次 `onShow` 都替换来源状态；只有 `launch_from === 'homepage'` 且 `location === 'sidebar_card'` 时确认本次从侧边栏进入。普通回前台清除该确认。
7. 不发奖励、不记积分、不改变关卡完成度，不虚构礼包/营销活动。

## 检查结果与边界

- 根测试 85/85 通过；10/10 手工关卡可解；归档独立平台样本 4/4 通过。
- 最终 `game.js` 在没有 document/window/localStorage 的 tt VM 模拟环境中启动、通关第 1 关并走侧边栏实际 UI/API 路径。
- 运行时不需要 Node、DOM、fetch、网络、账号、登录信息、外部图片或远端音频；只读写该游戏自己的本地进度键。
- 移除运行时 `Array.at`、`Object.fromEntries`、`structuredClone` 依赖；移除候选包可选链/空值合并语法。保留 ES2018 级别语法和 ES2017 标准内建（如 Object.entries、Map、Set、Promise），构建本身不做语法转译。项目配置要求官方工具进行 ES6 编译，但正式工具结果仍需实际执行确认。
- Canvas 只使用常规 2D 路径/变换/文本/剪裁；`setLineDash` 是可选装饰，缺失时不中断。透明色使用标准 rgba 字符串。
- 原生宿主留出状态栏+48px 顶部区与12px底部，渲染和输入同时适配。实际胶囊位置、半屏、小屏字体、不同设备触摸仍须真机检查。
- 真实浏览器视觉检查仍受执行环境隔离限制。VM 测试不是官方模拟器、手机验证或视觉验收。
- 当前无已知阻止模拟启动的缺陷。官方编译、预检、平台侧边栏跳转、音频/字体、iOS/Android真机都仍是待验证项。
- 官方指南说明未上线游戏可能不出现在真实侧边栏列表，因此测试阶段需按官方工具支持方式验证；不能将游戏暂不可见当成已完整往返成功。

## 官方依据

- 上传预检与必接能力：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/mini-app-developer-instrument
- 侧边栏技术指南：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/open-ability/Introduction-for-tech
- 小游戏 navigateToScene：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/open-capacity/sidebar-capacity/tt-navigate-to-scene
- onShow：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/foundation/system/lifecycle/tt-on-show
