# Mod 索引

`mods/` 是功能载荷的唯一源码；`src/` 只放安装器。安装包将所需 mod 放在 `mods/<名称>/` 下。

| Mod | 功能 | 依赖 / 安装包 | 能否单独装卸 |
|---|---|---|---|
| persona | 爱莉人格 preset、语音使用文档；不附带语音引擎 | 核心包；包2 `elysia-pkg2-persona.zip` | 可以，不依赖记忆、QQ、视频 |
| qq | QQ 桥插件与 Python 分身 | 核心包、NapCat；包3 `elysia-pkg3-qq.zip` | 可以，人格推荐另装 |
| memory | 长期事实、候选线索、简报和手动整理 | 核心包；包5 `elysia-pkg5-memory.zip` | 可以，独立 profile bundle |
| video | 视频分析、抽帧、场景检测和 GIF | 核心包、ffmpeg/ffprobe；包4 `elysia-pkg4-video.zip` | 可以 |

CosyVoice 引擎与声线素材仍由用户另行准备，使用说明见 `persona/docs/voice-guide.md`。
