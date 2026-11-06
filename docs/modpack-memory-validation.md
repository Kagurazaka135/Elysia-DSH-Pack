# Mod 化与记忆补齐验证报告

基线：`master@3dffa04`。施工分支：`feat/modpack-and-memory`。本轮执行 A/B 层及隔离模拟检查；未运行真实 dsh、安装器、NapCat 或模型，未安装额外运行环境。C/D/E 均待维护者验收。

经需求澄清，步骤 0 先验证已有四包，步骤 3 加入记忆后再验证五包。群聊按指定 guard 拒绝 `memory_*` 调用，不隐藏工具；E5 的工具清单要求未满足。按要求保留上游原样，记录简报与文件读取隔离缺口，不扩展修复。

## A · 静态与打包

| 执行 / 检查 | 观察结果 |
|---|---|
| 步骤 0：使用 `tools/repack.py` 的四包子集构建与检查 | 4 包通过后，才提交并开始会话功能修改 |
| `node --check mods/qq/plugin/lib/index.js` | 退出 0，无语法错误 |
| `python -m py_compile mods/qq/qq-elysia.py` | 退出 0；未导入运行分身 |
| PowerShell `Parser.ParseFile` 解析 `src/*/setup.ps1` | 5 个文件无解析错误；没有执行安装器 |
| `python tools/repack.py` | 重建五包，并将重新编码的 `install.bat` 同步回源码入口 |
| `python tools/repack.py --check` | 5 包全绿：条目集合、逐文件内容、CRLF、UTF-8 BOM、base64 round-trip 全通过 |
| `node --test tests/qq-sessions.test.mjs` | 8/8 通过，无失败；宿主 API 均为模拟对象，磁盘读写使用独立测试目录 |
| `rg -n '嗯哼' mods/qq/qq-elysia.py` | 零命中 |
| 对所有 Git 跟踪文件扫描原包2目录名与原包2 zip 名 | 零命中；旧 zip 不在当前树中，内部底稿与临时目录不属于交付物 |
| `git log --follow --oneline -- mods/persona/preset/agent.cordis.yml` | 能追到基线之前的 `9d79072`，迁移提交为 `22f1461` |
| `git diff --check` | 无空白错误 |
| 遍历 zip 中条目 | 无反斜杠、重复条目、旧平铺载荷、`setup.ps1`、依赖目录、lockfile、Python 缓存或声线文件 |
| 对照上游 `git show cd52ec9:<相对路径>` | 39 个文件在工作区和提交的 Git blob 中均逐字节相同；上游工作树干净 |
| 解析基线与当前 `tools/repack.py` 的 AST | `payload_bytes`、`encode_bat` 函数完全相同，编码约定未改 |
| 在临时 zip 添加额外旧条目后调用 `verify` | 正确拒绝；正式产物未受负例修改 |

包内数量及布局：

| 包 | 文件数 | 载荷位置 |
|---|---:|---|
| pkg1-core | 2 | 无功能载荷 |
| pkg2-persona | 10 | `mods/persona/` |
| pkg3-qq | 6 | `mods/qq/` |
| pkg4-video | 12 | `mods/video/` |
| pkg5-memory | 42 | `mods/memory/` |

每个 `src/pkgN/` 均仅含 `install.bat`、`setup.ps1`、`README.md`。源码 BAT 与 zip 内 BAT 逐字节一致。包1 的可读安装脚本和已分发 zip 与基线相同；其源码 BAT 原先的嵌入载荷落后于可读脚本，本次由打包器同步到已有 zip 的内容，已分发的包1行为没有变化。

记忆载荷只含 `lib/`、`src/`、`cordis.patch.yml`、`package.json`、`README.md`，另附 `VERSION.txt`。版本固定为 `dsh-memory 0.2.4 (cd52ec9)`，完整来源提交为 `cd52ec9a8f3e1148cd1404ade0692f778d083101`。通过 `.gitattributes` 禁止对这份原样载荷进行换行转换。

### 人格与不变源码的证据

用 `git diff --find-renames=100% --summary 3dffa04` 对照原人格预设文件与新路径，结果如下（原目录标签缩写以避免旧名重新进入当前源码）：

```diff
rename {<原人格目录> => mods/persona}/preset/agent.cordis.yml (100%)
```

无正文 diff hunk；两个路径对应的完整 Git blob 相同，故 `prefix` 段以及多版本适配行均未修改。迁移前后 SHA-256 同为：

```text
ef12e0ecde141a8ba635805d36a8cfac738829ba2f4d7cc264aafda61454880d
```

Python 分身完整 Git blob 未改，迁移前后 SHA-256 同为：

```text
8edf1f7a975ac2b22f432a66dc02cb821fe65c7bd053d82bee53847451150634
```

共 21 个迁移文件（人格及文档、Python、视频插件、QQ manifest 与 patch）与基线 blob 相同。包2安装脚本仅修改载荷取址和文档提示路径，默认预设精确改写、复杂 YAML 防御和版本适配逻辑均保留；包3、包4的原安装脚本仅调整载荷取址。

## B · 逐项代码审读

下表位置均相对仓库根目录。未修改文件通过上述完整 blob 比较证明保留；改动处另由模拟检查验证关键边界，不能替代真实宿主验收。

| 特性 | 位置与保证 |
|---|---|
| P1 空白名单全拦 | `mods/qq/qq-elysia.py` 的 `load_qq_config` 默认空集合，`handle_message` 先检查成员；插件 `effectiveAuth` 读取共享配置后按成员判断，空名单返回 403。模拟已验证。历史 profile 兜底仍保留空名单放行语义，不在本次改动范围，不能宣称所有路径均 fail-closed |
| P2 非白名单静默 | Python `handle_message` 在转发或回复前直接 return；Python blob 不变 |
| P3 群白名单与 @ | 同函数保留 `ALLOWED_GROUP_IDS` 判断、`is_at_me` 与非 @ return。历史空群名单不限制群、`@all` 也算命中的语义保留，本次未放宽 |
| P4 去重 | Python `dedup_is_repeat` 使用锁、10 秒窗口与容量上限；`handle_message` 键包含用户、群、文本、首图 URL |
| P5 图片限制 | Python `download_images` 校验腾讯 CDN 域名、最多 3 张、每张最多 5 MiB、魔数识别、ffmpeg 400px 压缩；失败/缺 ffmpeg 的原图回退保持不变 |
| P6 纯图与失败回复 | Python `handle_message` 允许文字为空而有图；全失败且无文本时发送原有话术。插件 inject 仍接受 `text` 或 `images` |
| P7 401/403 | 插件两条 HTTP 路由保留口令判断，inject 白名单失败为 403；Python `ForwardError` 和 `handle_message` 分别给出口令/名单话术。模拟已验证两种状态 |
| P8 WS 兼容与 token | Python `ws_connect` 按 connect 实现模块选择 `additional_headers` / `extra_headers`，设置 token；`main` 对头参数错误保留翻面自愈 |
| P9 协程回收 | Python `main` 的 finally 取消并等待 poll/heartbeat 任务；游标写入的 finally 保留 |
| P10 ffmpeg 错误 | Python `find_ffmpeg`、`wav_to_amr_base64` 明确报缺失，`main` 保留启动警告 |
| P11 TTS | Python `poll_replies` 的 `len(reply) <= 100` 语音分支原样保留 |
| P12 心跳 | Python `main` 的 heartbeat 每 30 秒发送 `get_login_info`，退出时随任务回收 |
| Q1 会话与回复 | 插件 `conversationKey` 分私聊/群；`userBySession` 保存创建时 `{userId, groupId}`；`qq_reply`、`pushReply`、事件兜底使用同一反向映射。模拟验证同一用户私聊/两群独立，并逆序回复到原窗口 |
| Q2 共享鉴权 | 插件 `effectiveAuth` 读取 `qq-config.json`，原缓存、profile 兼容兜底与两条路由鉴权逻辑不改；包3安装器的白名单、共享口令、NapCat 配置生成逻辑不改 |
| Q3 图片 block | 插件 `sniffImageMediaType` / `toImageBlocks` 保留魔数识别和每张文件的独立 try/catch；坏路径跳过后继续处理其他图片，函数正文未改 |
| Q4 图片硬门 | 插件 `routeImageCapable` 与 inject 的能力判断不改；明确不支持图片时不注入 image block |
| Q5 内存边界 | `readBoundedBody` / `maxBodyBytes`、`pushReply` / `replyBuffer` 不改；模拟验证 413 与队列上限 |
| Q6 卸载回收 | agent teardown 遍历新的 `agentsByConversation` dispose 全部 handle，清内存；持久映射文件不删。模拟已验证 |
| Q7 事件兜底 | `session/event` 保留最后非空文本，turn/end 入队；`repliedThisTurn` 防止与 `qq_reply` 双发。模拟已验证 |
| R1 人格正文 | 上文完整 blob、SHA-256、100% rename 证据，正文零变化 |
| R2 多版本适配 | 预设 blob 不改；包2检测 ptc/worker-thread 与校准逻辑不改，仅载荷路径更新 |
| S1 编码 | 编码函数 AST 不变；五包都验证 base64 解回可读 PS1、UTF-8 BOM、CRLF 与骨架一致 |
| S2 全包重打 | 最后统一执行重打与 `--check`；源码 BAT 也同步再编码，旧条目全部删除 |
| S3 内部件忽略 | `.gitignore` 保留 wav、HANDOFF、改进计划、ZCode 等规则，补任务书与 mod lockfile 规则；不强制添加内部件 |

### 新增功能与安装器审读

| 项 | 实现与验证 |
|---|---|
| D1/D2/D4 | `mods/` 为载荷真源，`src/` 仅安装器；包2目录与 zip 按功能改名；`PAYLOAD` 对应五包。新增 zip 可直接创建，重打删除旧平铺条目，`--check` 实际发现差异时失败 |
| D3 | 记忆为独立 profile bundle 与独立包，不写进人格 preset；未修改 dsh 插件包名 |
| M1 读取 | `loadSessions` 校验 version、对象及字符串 ID，文件不存在当空；坏 JSON/格式只 warn。`sessionStorePath` 默认 cwd 下 tasks 目录，可配置 |
| M1 写入 | `saveSession` 保留其他键，只更新当前键；写 `.tmp` 后 rename，失败只 warn。模拟 rename 失败时消息仍 200，原磁盘映射不变 |
| M1 续场 | `agentFor` 按需取可选 `sessionPersistence`，不加到 inject；resume/create 传递同一个 setup。三类续场异常均记录类型并换随机 ID create，再覆盖当前映射；模拟已验证 |
| M1 初始化 | 共用 setup 挂模型选择、已有 blockedTools、预设与 standard 降级。模拟验证空 preset、预设缺失、两层失败均保持原有行为 |
| M2 | `conversationKey` 形态为私聊 `qq-<userId>`、群 `qq-<userId>-g-<groupId>`。已有内存 handle 复用；无映射的升级前旧会话不扫描、不迁移 |
| M3 | groupId 非空时 guard 先拒绝 `memory_` 前缀，私聊只受原 blockedTools 影响；create 和 resume 两条路径均模拟验证。没有实现工具清单隐藏 |
| pkg5 幂等 | 安装前读 profile manifest，dependencies 已有 dsh-memory 就提示并正常退出，发生在复制前；支持 `DSH_HOME`，默认用户目录；没有 npm install |
| pkg5 失败与路径 | 与包3使用同一个既有安装根；执行 cmd 包装的 `dsh plugin --profile web add`。命令非零或异常只黄色提示，所有显式退出均为 0 |
| 文档 | 根 README 已有五包、新源码未发布条目和历史 Release 链接；没有创建虚构版本。mod 索引与包5说明包含独立安装/卸载、schedule 缺失、真实验收待办 |

## C/D/E · 维护者验收

| 项 | 本轮状态 | 待验收判据 |
|---|---|---|
| C 插件加载 | 环境不具备，交回维护者 | 无模块缺失；replies HTTP 返回 ok；`request/header.tools` ≥ 27 |
| D1 重复安装 | 环境不具备，交回维护者 | 连装 pkg5 两次，第二次提示跳过，manifest 无重复依赖 |
| D2 隔离安装 | 环境不具备，交回维护者 | 隔离 DSH_HOME 装五包后正常启动，无记忆加载错误 |
| E1 重启续场 | 环境不具备，交回维护者 | 私聊事实在重启后接续，映射 ID 不变；模拟通过不代表真实通过 |
| E2 坏映射 | 环境不具备，交回维护者 | 不存在 ID 时正常回话、warn 且新 ID 覆盖 |
| E3 上下文隔离 | 环境不具备，交回维护者 | 私聊与各群独立。共享记忆仍可能带来跨场合信息，不能以独立会话证明完整隐私隔离 |
| E4 回复窗口 | 环境不具备，交回维护者 | 群回复落在原群，不误投私聊或其他群 |
| E5 工具不可见 | 未满足；实机部分环境不具备，交回维护者 | 指定 guard 只拒绝执行，不从 `request/header.tools` 隐藏 `memory_*`；按确认范围记录限制 |
| E6 记忆写入 | 环境不具备，交回维护者 | 私聊事实写进 `facts.yaml`；未调用真实模型或工具 |
| E7 跨会话记忆 | 环境不具备，交回维护者 | 重启后仍能回答长期事实 |
| E8 elysia 可见性 | 环境不具备，交回维护者 | 确认是 elysia 而非 standard，再验记忆工具可见及 E6 |

完整隔离缺口：上游 `lib/index.js` 注册 `systemPrompt` 扩展，`lib/prompt.js` 的 `registerMemoryPrompt` 注入共享简报快照，没有 QQ 群聊条件；其他文件工具也不受 `memory_*` 名称闸门约束。因此群聊记忆并未完全隔离。本轮按确认范围不修改上游，也不声称 E5 或完整隔离已通过。自动整理需要 schedule 服务，本包固定版本不具备该服务，不作为本轮失败项。
