# Official Douyin CLI validation

Updated 2026-10-14 UTC. This supplements the earlier runtime spike snapshot.

## Verified results

- Official package `tt-minigame-ide-cli@2.1.1` was retrieved from `https://registry.npmjs.org` and installed in an isolated tooling directory after explicit owner approval.
- Installation used `--ignore-scripts --no-audit --no-fund`. No dependency lifecycle scripts ran. The dependency graph contains 387 installed packages; some dependencies emitted deprecation warnings. No security audit result is claimed.
- Runtime: Linux x86_64, Node.js v24.19.0, npm 11.9.0.
- `tmg --version` prints `2.1.1`, exit 0.
- `tmg --help`, `tmg login --help`, `tmg preview --help`, and `tmg upload --help` all exit 0.
- Execution used the package-supported `ALLOW_REPORT_EVENT=no` flag to suppress CLI telemetry. Version/help commands did not sign in or upload any project.
- Package metadata has no declared `engines`, `os`, or `cpu` requirement. Successful help commands establish basic execution on this Linux/Node combination, not successful compilation/upload.

The exact help output is in `artifacts/linux-cli-help.txt`. The non-secret package manifest and lockfile are in `tooling/` for reproducibility. Do not place `node_modules`, login caches, configuration containing credentials, or generated authentication material in this repository.

Official package tarball:
`https://registry.npmjs.org/tt-minigame-ide-cli/-/tt-minigame-ide-cli-2.1.1.tgz`

Registry integrity:
`sha512-EX5xE659IcUxOYhABqIP42XmZV/VvsFzaEHzwJGeR8IrFQNtx0kWMkdbad0QjnBoPUIQAsy0MjGrC2uEq6+oUA==`

## Authentication and network status

The actual 2.1.1 command list exposes phone and email login, but no QR-login command. The exported public Node API exposes `loginByPhone`, `loginByEmail`, `checkSession`, and `logout`; internal bundled declarations are not evidence of supported public exports.

The first owner-authorized phone sign-in attempt timed out before confirming SMS delivery. After explicit approval for one resend, the CLI used the environment's existing proxy, confirmed sending a verification code, and accepted the owner-supplied code once. The official tool printed `Login success` and exited 0. No OTP or session token was printed into artifacts. Normal login-session files are isolated outside every source repository; their permissions and lifecycle are tracked separately without copying their contents here.

Read-only HEAD requests through the environment's existing proxy succeeded for the official login-service host (301 to the platform host) and platform host (200). The failed CLI request logged its own proxy as unset. The documented `--proxy` flag using that same approved egress route resolved the observed sign-in connection problem on the explicitly authorized retry. No system/network security settings were changed.

No further SMS requests are pending. Any new sign-in must remain within authorization and use the issuing service's matching account only. Do not request a password in chat or copy session tokens into logs/source control. CAPTCHA, unexpected permissions, or new persistent-access grants require their applicable confirmation flow.

## Remaining gates before a test upload

1. Ordinary service login succeeded. Recheck session validity before using it; do not create new persistent-access credentials.
2. Verify exact real AppID and owner/developer access for the selected game.
3. Run candidate build and all available code/adapter tests; distinguish mocked tests from browser and real-device checks.
4. Complete actual platform precheck, including functional sidebar revisit integration rather than a dead API string.
5. Upload only the requested test version, preserving the separation from review submission or public release.
6. Verify the resulting platform version and QR-code access on an authorized device. No compile/upload/QR/device result is currently claimed.

## Official references

- CLI: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/development-assistance/ide-cli
- Package: https://www.npmjs.com/package/tt-minigame-ide-cli
- IDE/test AppID constraints: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/mini-app-developer-instrument
- Sidebar integration: https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/open-ability/Introduction-for-tech
