# Native viewport correction 0.3.1

Native Canvas uses positive resize-event container dimensions first, then screen dimensions, then window dimensions. Pixel ratio is applied once to backing store/rendering; touch coordinates remain logical pixels. Safe insets are bounded in that coordinate system. getMenuButtonLayout is preferred with the older bounding-client API fallback. Window resize cancels old gestures.

Existing warehouse art paints every viewport pixel, including safe insets and wide-screen side regions. The 480px workbench control width remains intentionally readable and centered without stretching square parcel cells. No gameplay, level, economy, reward or persistence changes.

310 tests pass (302 existing + 8 exact-native-bundle viewport tests); 50 reference solutions and 40 bad-seal/revival cases pass. Profiles 320×568 through 768×1024 cover screen/window mismatch, DPR1–3, safe controls, resize-event priority, touch cancellation and cleanup. Native Canvas raster previews in artifacts/native-viewport were inspected; these are simulated-host renders, NOT physical-phone screenshots or official emulator validation. Upload and phone retest remain separate.

Reproduce: npm run build; npm test; npm run verify; node qa/render-native-viewport.mjs.

Official semantics references from project viewport review:
https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/javascript-api/drawing/picture/tt-create-canvas
https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/api/interface/menu/tt-get-menu-button-layout
