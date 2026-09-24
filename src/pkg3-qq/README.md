# 包3 · QQ 扩展（QQ包）

> 让爱莉接入 QQ——上班、外出也能聊天（文字+语音），还能给你干任务！
> 前提：先装好 包1（推荐再装 包2）。

## 安装（约 10 分钟）
1. 下载 **NapCat**（QQ 协议程序，约 110MB）：
   https://github.com/NapNeko/NapCatQQ/releases
   选 `NapCat.Shell.Windows.Node.zip`，解压到 `D:\AI\JARVIS\napcat\`
2. 双击本包 **install.bat**（会自动把插件装进 DSH，需要联网约 1 分钟）
3. 按提示：启动 NapCat → **用 QQ 小号扫码登录**（UAC 弹窗点"是"）
4. 登录完成后：
   - 确保 DSH 在跑（双击桌面的 `start-elysia.bat`）
   - 运行分身：`python D:\AI\JARVIS\qq-elysia.py`
5. 用你的大号 QQ 加小号好友 → 发消息 = 和爱莉聊天！

## 功能
- 💬 **私聊**：发消息爱莉就回
- 👥 **群聊**：@ 爱莉 才回，不吵群
- 📋 **任务**：直接说就行，爱莉是完整的 DSH，能读写文件、跑命令
- 🔊 **语音**：回复短于 100 字会附语音条 —— **需要先装好 CosyVoice**（见下）
- 🖼️ **看图**：**暂不支持** —— 发图片会被忽略，爱莉只看得见文字

## 包内容
```
qq-elysia.py    # QQ 分身（消息收发+语音）
plugin/         # DSH 插件（QQ↔DSH 的桥，install.bat 会自动装进 DSH）
install.bat
README.md
```

## 常见问题
- **没有语音**：先看分身后台的日志。多半是没装 CosyVoice —— 语音链路需要
  包2 里那个约 3GB 的模型（见包2 README 第 3 节）。没装时**文字照发**，不会丢消息
- **重复消息**：分身已内置去重（10秒内同消息只回一次）
- **发图片没反应**：对的，暂不支持（只看得见文字）
- **NapCat 登录不了**：确认小号没在其他地方登录
