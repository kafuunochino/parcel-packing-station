# Canvas2D runtime compatibility spike

This is a local proof workspace, not a fourth game repository and not a published site.
It demonstrates a reusable pure JavaScript + Canvas2D architecture. It is not a claim
that Douyin compilation, upload, preview, real devices, WeChat, or review have passed.

## Architecture and locked contract

Game code exports `startGame(platform)` and returns `{ destroy() }`. Pure rules and
Canvas rendering must not read DOM/BOM, `window`, `document`, HTML controls, or direct
browser storage. Browser APIs belong exclusively in `adapters/browser.js`.

The platform has:
- `canvas`, already sized to logical dimensions × DPR.
- `getSize()` returning `{ width, height, dpr }` in logical pixels.
- `onPointer(fn)`, `onResize(fn)`, `onPause(fn)`, `onResume(fn)` returning unsubscribe functions.
- Pointer events `{ type: 'down'|'move'|'up'|'cancel', x, y, id }` in logical pixels.
- `requestFrame(fn)` and `cancelFrame(id)`.
- `storage.getItem(key)` returning a string or null, and `storage.setItem(key, string)`.
  These may throw. The game must continue without persistence if storage is unavailable.
- `audio.play(name)` and `audio.setMuted(boolean)`. Both adapters map names to bundled
  audio assets. Missing/failed audio must not prevent gameplay.

The renderer owns `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` before drawing. Do not
multiply input coordinates by DPR. Game destruction removes its subscriptions;
platform destruction additionally removes host listeners and releases audio.

The tt adapter targets portrait-only demos, refreshes viewport metrics on resume,
and has no browser-global dependency. It has only been tested against a fake host.
Safe-area/menu-capsule layout, tablet/window/orientation changes, actual audio,
low-end performance, and multi-touch gesture policies still need device validation.
The optional `sidebar` capability is an additional platform feature, not required by
the base game contract and not present in a browser or future wx adapter by default.

## What was tested on 2026-10-14

Commands: `npm run build`, `npm test` using Linux x86_64, Node v24.19.0, npm 11.9.0.
No package dependencies are needed or installed for these checks.

Four tests pass:
1. One on-screen canvas, DPR sizing, touch-to-pointer mapping and unsubscribe.
2. Storage denial, pausing/resuming without duplicate loops, idempotent destruction.
3. Generated `dist/douyin/game.js` boots in a Node VM with no window/document/localStorage,
   using fake tt, fake Canvas2D and fake frame scheduling. This is not a Douyin VM.
4. Sidebar support gating, real API invocation shape, newest onShow tracking and failure paths.

See `artifacts/node-tests.txt`. Browser pixel and click verification is NOT yet passed.
The first headless Chromium attempt failed before opening a page with
`socket() failed: Operation not permitted`. A loopback server started in an execution
session was not reachable from another execution command or the cloud browser;
process/network isolation is suspected, not proven. A further same-process browser
check was blocked by execution-environment initialization before Python ran.
No network exposure was expanded. The reproducible browser check is saved as
`scripts/browser-proof.py` and must still pass in an approved working environment.

## Build and manual verification

`npm run build` generates `dist/douyin/game.js`, `game.json`, `project.config.json`,
and a tiny locally generated audio file. AppID is deliberately empty. No account,
app, credential or token was created. No platform upload or preview was performed.

The spike's build script is a fixed-file assembler for exactly these audited source
files. It is not a general-purpose ESM compiler. Production demo repositories should
use a vetted pinned bundler, or a strict finite-module assembler that rejects unknown
imports/exports and executes its own DOM-free bundle smoke test.

`npm start` requests a loopback-only server on port 4199. Browser bootstrap is in
`index.html`; there are no gameplay HTML buttons. In a suitable browser environment,
verify tap counter, pointer coordinates at DPR 1/2/3, reload persistence, resize,
background/foreground and muted/failed audio. Browser passes still do not replace tt.

## Official feasibility findings

- Native mini-games are a JavaScript VM without DOM/BOM. `tt.createCanvas()` and
  `canvas.getContext('2d')`, touch events and frame scheduling are supported.
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/bytedance-mini-game
- Official starter shows Canvas2D and native touch wiring, plus CommonJS modules.
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/newbie-tutorial
- Official CLI package is `tt-minigame-ide-cli` (binary `tmg`), not mini-app `tt-ide-cli`.
  Preview uploads project data and yields a QR code. It is not a local GUI emulator.
  CLI documents phone/email login; browser console login does not prove CLI login.
  It also documents telemetry opt-out via `tmg set-config -r no`.
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/development-assistance/ide-cli
- Registry metadata query succeeded: current package 2.1.1, tmg -> bin/tmg.js,
  with no declared engines/os/cpu fields. Missing limits do NOT establish tested Linux
  or Node 24 support. The official desktop IDE download page lists macOS and Windows,
  not a Linux distribution; CLI `open` merely launches that installed desktop IDE.
  https://www.npmjs.com/package/tt-minigame-ide-cli
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/developer-instrument-update-and-download
- IDE supports a test AppID for preview/debug, not upload. CLI test-ID workflow was
  not verified. Real AppID plus developer permissions are needed for test-version upload.
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/mini-app-developer-instrument

The CLI has not been installed or executed. Only official documentation and npm
registry metadata were successfully read. CLI acquisition and execution await the
project owner's pending installation confirmation.

## Sidebar capability and remaining platform gate

`adapters/douyin-sidebar.js` registers onShow synchronously, checks `tt.checkScene`
before exposing navigation, makes an actual `tt.navigateToScene({scene:'sidebar'})`
call only after a user click, tracks the latest entry parameters, and reports failures.
The spike displays a real navigation test button only on a supporting host. It does
not fabricate a reward system or claim this minimal navigation proof passes review.
A finished game needs a visible, honest return flow and any promised reward must be
implemented and validated. Upload precheck requires the sidebar integration.

- Check API: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/open-capacity/sidebar-capacity/tt-check-scene
- Navigate API: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/open-capacity/sidebar-capacity/tt-navigate-to-scene
- Required integration/testing: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/open-ability/Introduction-for-tech

The technical guide says an unreleased game's full real-device sidebar flow may
require support allowlisting; IDE simulation and launch-parameter testing are other
paths. Do not promise a working physical sidebar loop before checking these conditions.

Remaining gates: approved CLI acquisition and compatible runtime test; CLI login or
other documented supported authentication; real AppID/project permission; application
creation contact details and disclosed agreement acceptance; platform compilation and
precheck; authorized test upload; authorized-device QR scan and actual on-device QA.
No formal public release, review submission, account creation or credential generation
is authorized by this proof workspace alone. Do not copy secrets into source or GitHub.
