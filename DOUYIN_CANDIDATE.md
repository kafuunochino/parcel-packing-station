# 快递收纳站 · 抖音测试候选

2026-10-14。本文件记录源码构建候选，不代表已经上传、通过审核或通过真机体验。

## 身份与产物

- 控制台核实的应用：快递收纳站。
- 非敏感 AppID：`tt8a23fc9e145a412a02`。
- 候选版本：`0.3.0`。
- 规范配置：`config/douyin.json`。可用环境变量 `DOUYIN_APP_ID` 做明确测试覆盖；不保存凭证或联系方式。
- 构建：`npm run build`。
- 上传任务应使用目录：`dist/douyin/`，不是根目录或浏览器 HTML。
- 文件：`game.js`、`game.json`、`project.config.json`、`assets/tap.wav`、`assets/place.wav`、`assets/squeeze.wav`、`assets/error.wav`、`assets/win.wav`。
- 精确逐文件 SHA-256：`artifacts/douyin-candidate-manifest.json`（本次冻结副本），以及每次构建生成的 `dist/douyin-build-manifest.json`。
- 登录、预检、上传由获授权的独立平台操作执行；本构建脚本不会联网或上传。

## 已实现的必接侧边栏路径

1. `createTTPlatform` 开始时同步创建 sidebar adapter，在 Canvas 和游戏启动前监听 `tt.onShow`。
2. 同时检查 `tt.checkScene` 与 `tt.navigateToScene` 是否存在，并通过实际 `checkScene({scene:'sidebar'})` 判断支持。未支持、查询失败或尚未确认时不显示入口。
3. 支持后在游戏内「工位设置」显示 Canvas「侧边栏复访」按钮。点击只打开说明，不产生外部导航。
4. 玩家明确点击「打开侧边栏」后调用实际 `tt.navigateToScene({scene:'sidebar'})`。
5. `pending` 防重入。失败/取消恢复可玩状态。导航成功只表示 API 成功，不表示玩家已经返回。
6. 每一次 `onShow` 都替换来源状态；只有 `launch_from === 'homepage'` 且 `location === 'sidebar_card'` 时确认本次从侧边栏进入。普通回前台清除该确认。
7. 不发奖励、不记积分、不改变关卡完成度，不虚构礼包/营销活动。

## 检查结果与边界

- 本候选是0.3.0五十关封签战役与金币/模拟奖励扩展。必须重新验证，历史0.1.0 CLI或平台结果不自动沿用。本轮没有上传、发布或提审。

- 根测试302/302通过；50/50初始关卡和逐批参考解通过；40/40错误封签死局及复活验证。归档旧平台样本仅为历史证据。
- 最终 `game.js` 在没有 document/window/localStorage 的 tt VM 模拟环境中启动、通关第 1 关并走侧边栏实际 UI/API 路径。
- 运行时不需要 Node、DOM、fetch、网络、账号、登录信息、外部图片或远端音频；只读写该游戏自己的本地进度键。
- 移除运行时 `Array.at`、`Object.fromEntries`、`structuredClone` 依赖；移除候选包可选链/空值合并语法。保留 ES2018 级别语法和 ES2017 标准内建（如 Object.entries、Map、Set、Promise），构建本身不做语法转译。项目配置要求官方工具进行 ES6 编译，但正式工具结果仍需实际执行确认。
- Canvas 只使用常规 2D 路径/变换/文本/剪裁；`setLineDash` 是可选装饰，缺失时不中断。透明色使用标准 rgba 字符串。
- 原生宿主读取安全区与可用时的胶囊矩形；缺少胶囊能力时保守预留状态栏+48px顶部区、至少12px底部。浏览器读取CSS env安全区。渲染和输入使用同一实际像素偏移，不缩小按钮。实际胶囊位置、半屏、小屏字体、不同设备触摸仍须真机检查。
- 真实浏览器视觉检查仍受执行环境隔离限制。已做nativeCanvas字体与像素检查，但它不是浏览器截图。VM/nativeCanvas测试不是官方模拟器或手机验证。
- 广告接口在TT中默认disabled，没有真实广告ID或SDK广告调用；浏览器仅有人工四结果mock，不进入实投。金币只来自首次通关，仅消费于两种有限道具和拆签复活，免费重开常驻。
- 当前无已知阻止模拟启动的缺陷。官方编译、预检、平台侧边栏跳转、音频/字体、iOS/Android真机都仍是待验证项。
- 官方指南说明未上线游戏可能不出现在真实侧边栏列表，因此测试阶段需按官方工具支持方式验证；不能将游戏暂不可见当成已完整往返成功。

## 官方依据

- 上传预检与必接能力：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/mini-app-developer-instrument
- 侧边栏技术指南：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/open-ability/Introduction-for-tech
- 小游戏 navigateToScene：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/open-capacity/sidebar-capacity/tt-navigate-to-scene
- onShow：https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/foundation/system/lifecycle/tt-on-show
