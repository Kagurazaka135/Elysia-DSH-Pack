# 爱莉语音引擎安装指南（手动 · 可选）

> 让爱莉**说话**（文字转语音）。装好她才有声音～
> 说明：语音引擎约 3GB，装完本地运行，**免费、离线、不联网**。

## 一、需要什么
- Windows 电脑 + 约 8GB 空闲磁盘
- Python 3.10（64 位）
- ffmpeg（`ffmpeg -version` 能输出即可）

## 二、下载模型（约 3GB）
从 ModelScope 下载（国内快）：

1. 打开 https://modelscope.cn/models/iic/CosyVoice2-0.5B
2. 点「下载模型」，选择 **Git clone 或 直接下载**，存到：
   `D:\AI\JARVIS\models\cosyvoice2\`
   （最终目录里应有 `flow.pt`、`llm.pt`、`cosyvoice2.yaml` 等文件）

> 文件较大，建议用 ModelScope 官方工具下载，支持断点续传：
> ```
> pip install modelscope
> modelscope download --model iic/CosyVoice2-0.5B --local_dir D:\AI\JARVIS\models\cosyvoice2
> ```

## 三、安装 CosyVoice 代码（约 10 分钟）
```bat
git clone https://github.com/FunAudioLLM/CosyVoice.git D:\AI\JARVIS\cosyvoice
cd /d D:\AI\JARVIS\cosyvoice
python -m pip install -r requirements.txt
```

> 路径别换地方：爱莉的语音分身（`qq-elysia.py`）按 `D:\AI\JARVIS\cosyvoice` 找引擎代码。

## 四、放好爱莉的声音样本
语音克隆需要一段「参照音」。

> ⚠️ **本包不含声线素材** —— 那 20 条 `g-01.wav` ~ `g-20.wav` 是游戏配音片段，
> 版权不属于本项目，没有随包分发。请从**原整合包**处获取（见仓库根目录 README）。

拿到之后，复制全部 `g-01.wav` ~ `g-20.wav` 到：
`D:\AI\JARVIS\models\elysia-voice\clips\guide-elysia\`
（爱莉会用不同的参照音切换语气：g-05 元气早安、g-11 深情告白…）

**如果只有自己的录音**：任意一段 5~10 秒、干净人声的 wav 也能用，
CosyVoice 是零样本克隆，不需要和爱莉是同一个声音。

## 五、首次运行（验证）
在 CosyVoice 代码目录里跑官方示例，确认引擎可用：

```bat
python webui.py --port 9880
```
浏览器打开 http://127.0.0.1:9880，在「跨语言/零样本」栏：
- 参照音频选 `g-05.wav`
- 输入文本：`你好呀，我是爱莉希雅♪`

点合成 → 听到声音 = 成功！之后爱莉的合成脚本（如 cosyvoice-tts.py）会调用同一套引擎。

## 六、常见问题
| 问题 | 解决 |
|------|------|
| 报错 `No module named 'cosyvoice'` | 没装 requirements，见第三节 |
| 下载太慢 | 用 modelscope 命令下载，别用浏览器 |
| 没声音输出 | 检查 ffmpeg：`ffmpeg -version` |
| 爆显存/内存 | 减小 `max_token_num`，或改用 CPU 推理（慢但稳） |

## 七、音频版权说明

语音克隆基于**公开配音素材**的个人学习使用；**请勿用于商业或冒充用途**。

爱莉希雅的角色与配音素材版权归**米哈游**所有。本仓库因此不随包分发任何 wav 素材
（`.gitignore` 已排除 `*.wav`），需要声线请自行准备 —— 见第四节。
