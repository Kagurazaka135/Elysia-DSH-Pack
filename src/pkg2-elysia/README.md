# 包2 · 爱莉人格 + 声音（爱莉包）

> 让 DeepSeek Harness 变成"爱莉希雅"——温柔、俏皮、会关心人。
> 前提：先装好 包1。

## 安装（约 1 分钟）
1. 双击 **install.bat**（弹 UAC 点"是"）
2. 自动把爱莉人格装进 DSH，并把默认预设设为 elysia
3. 完成！**已开着的网页刷新一下（F5）**；没在跑就双击桌面的「start-elysia.bat」

## 怎么用
- 新会话**默认就是爱莉希雅**（安装脚本会改 `~/.dsh/settings.yaml` 里的 `agent-presets.default`）
- 想切回标准模式：新建会话时手动选「标准模式 / standard」即可
- 开口就是爱莉啦！她会用"♪/～/呀/呢"说话，会关心你，会撒娇

## 装到旧版 dsh 上也能用
预设里的 workflow 行是按 **0.1.6** 写的（`@deepseek-ai/dsh-workflow-ptc`），
而 **0.1.5.x** 上只有 `@deepseek-ai/dsh-workflow-worker-thread` —— 名字对不上时，
DSH 会把整个预设标成**「加载失败」**（红标签，选都选不了）。

安装脚本现在会：

1. 检测本机实际装了哪个包，自动把那一行换成本机存在的名字；
2. 自检预设里每一行引用的插件是否都在本机，缺了就明确列出来
   （而不是让你对着一个红标签猜）。

## 声音（可选，约 10 分钟）
爱莉的声音分两部分：

1. **声线素材**（**本包不含，需自备**）：20 条 4~9 秒的爱莉配音片段，
   命名为 `g-01.wav` ~ `g-20.wav`，放成本目录下的 `voice-clips/`。
   这些是游戏配音素材，版权不属于本项目，所以没有随包分发 ——
   请从**原整合包**处获取（见仓库根目录 README 的「来源说明」）。
2. **语音引擎 CosyVoice**（约 3GB，需手动下载）：
   - 下载：https://modelscope.cn/models/iic/CosyVoice2-0.5B
   - 模型解压到 `D:\AI\JARVIS\models\cosyvoice2\`
   - 声线文件放 `D:\AI\JARVIS\models\elysia-voice\clips\guide-elysia\`
   - 完整步骤见 `docs/voice-guide.md`

## 包内容
```
preset/                  # 爱莉人格（agent.cordis.yml + 人格文档）
install.bat              # 一键安装（内嵌 PowerShell 脚本）
docs/voice-guide.md      # 语音引擎安装指南
README.md                # 本文件
```

## 常见问题
- **预设卡片是红色的「加载失败」**：说明预设里某一行引用的插件在本机不存在
  —— 最常见的就是 dsh 版本与预设不匹配（见上一节）。重跑一次 install.bat，
  它会自动换名并打印自检结果，照提示改即可。
- **预设列表没有 elysia**：先刷新页面（名单每次都重新扫盘，不用重启）；
  还没有就确认 `~/.dsh/.agent-presets/elysia/agent.cordis.yml` 存在。
- **新会话不是爱莉**：看 `~/.dsh/settings.yaml` 里 `agent-presets.default` 是不是 elysia
  （安装脚本会写；被别的东西改回去过就重跑一次）。
- **爱莉不像爱莉**：告诉她"读 docs 里的人格文档"，或手动把 ELY_PERSONA.md 内容发给她
