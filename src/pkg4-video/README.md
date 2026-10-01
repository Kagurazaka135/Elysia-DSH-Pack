# 包4 · 视频理解

装上后，爱莉在**网页**（`http://127.0.0.1:3080`）里就能"看"视频了——
总结画面内容、抽关键帧、检测镜头切换、做 GIF、查视频信息。

QQ 里暂时不行（QQ 桥目前连图片都不支持，视频更是另一摊活），视频功能只在网页面上用。

## 前提

- 已装 **包1（核心包）** 并填好 API Key（`dsh web` 能正常起）。
- **ffmpeg / ffprobe** 必须在系统 PATH 里——这是视频功能的底层依赖，本包**不自动装**，
  安装脚本会帮你检查，没有会给出指引。

## 装

1. 解压本包，双击 `install.bat`
2. 脚本检查环境（dsh、pnpm、ffmpeg）。**没装 ffmpeg** 时会停下来提示你：
   - 推荐新开一个命令行窗口执行 `winget install Gyan.FFmpeg`，
     装完**重开窗口**（让 PATH 生效）再回这个窗口按回车继续；
   - 或者到 https://www.gyan.dev/ffmpeg/builds/ 下载 `release-essentials.zip`，
     解压后把里面的 `bin` 目录加进系统 PATH；
   - 不想当场装也可以直接关窗——以后装好 ffmpeg，重启 dsh web 就生效，**不用重跑本包**。
3. 之后全自动：复制插件到 `D:\AI\JARVIS\dsh-video-frames` → 装依赖 → 注册进 dsh（profile: web）。

## 装完怎么用

重启 dsh web（关掉它的窗口，再双击桌面的 `start-elysia.bat`），
打开 `http://127.0.0.1:3080`，直接对爱莉说：

- 「帮我看下 `D:\videos\xxx.mp4` 里发生了什么」→ 画面内容总结
- 「这段视频有哪些镜头切换」→ 场景检测抽帧
- 「把开头 10 秒做成 GIF」→ GIF 片段
- 「这个视频多长、什么分辨率」→ 元数据

## 5 个工具

| 工具 | 干什么 |
|---|---|
| `video_analyze` | 抽关键帧 → 视觉模型 → 返回画面内容总结 |
| `video_frames` | 均匀抽帧（每 N 秒一帧） |
| `video_scenes` | 检测镜头切换点，每个切点抽一帧，跳过静态段 |
| `video_gif` | 掐一段视频转 GIF |
| `video_info` | 时长 / 分辨率 / 帧率 / 编码 / 有没有音轨 |

## 已知注意

- **ffmpeg 太老**：有的机器装着 2013 年前后的老版 ffmpeg（`ffmpeg -version` 一看便知），
  能跑，但**手机拍的 HEVC/H.265 视频解不动**，抽帧会失败。建议 `winget install Gyan.FFmpeg` 换新，
  并确保新版在 PATH 里排在旧版前面。
- **长视频**：先拿 `video_info` 看时长，或对爱莉说"只分析前 X 秒"，别一上来就把两小时的视频整个喂进去。
- **帧数上限**：`video_analyze` 一次最多喂 60 帧给模型（token 和耗时随帧数线性涨），默认值够用，别调大。
