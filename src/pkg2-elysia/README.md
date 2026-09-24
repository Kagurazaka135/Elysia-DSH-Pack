# 包2 · 爱莉人格 + 声音（爱莉包）

> 让 DeepSeek Harness 变成"爱莉希雅"——温柔、俏皮、会关心人。
> 前提：先装好 包1。

## 安装（约 1 分钟）
1. 双击 **install.bat**（弹 UAC 点"是"）
2. 自动把爱莉人格装进 DSH
3. 完成！**双击桌面的「start-elysia.bat」重启程序**（包1 安装时自动生成的启动器）

## 怎么用
- 新建会话时，**预设选择 "elysia" / 爱莉希雅**
- 开口就是爱莉啦！她会用"♪/～/呀/呢"说话，会关心你，会撒娇

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
- **预设列表没有 elysia**：重启 DSH 后再看
- **爱莉不像爱莉**：告诉她"读 docs 里的人格文档"，或手动把 ELY_PERSONA.md 内容发给她
