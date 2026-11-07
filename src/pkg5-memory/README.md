# 包5 · 长期记忆

独立安装 `dsh-memory 0.2.4 (cd52ec9)`：长期事实、候选线索、简报和手动整理。只依赖包1，不依赖人格包；不附带模型或声线素材。

## 安装与确认

1. 先装好包1，解压本包，双击 `install.bat`。
2. 安装器将 `mods/memory/` 复制到与 QQ 插件相同的安装根，再执行 `dsh plugin --profile web add <插件目录>`；不运行 `npm install`。
3. profile 已依赖 `dsh-memory` 时显示「已装过，跳过」，包括已从 GitHub 安装的版本，不覆盖原安装。
4. 重启 `dsh web`，确认日志出现记忆工具已注册且无加载错误，私聊可用 `memory_brief`、`memory_recall`、`memory_note`、`memory_candidate`、`memory_promote`、`memory_organize`。

记忆文件位于 `$DSH_HOME/memory/`（默认 `~/.dsh/memory/`）。可在私聊请求记住一条事实，再查看 `facts.yaml`；手动整理可调用 `memory_organize`。模型整理需要宿主已配置模型。

## 群聊与边界

QQ 群聊不启用 `memory_*` 工具调用，由 QQ 桥强制拒绝，私聊保留。此闸门不会隐藏工具名称，也不构成完整记忆隔离：上游插件可能把共享简报注入群聊提示词，其他文件工具也可能读取记忆目录。完整隔离需另行处理提示词与文件访问权限。

自动整理需要 `schedule` 服务，本包钉住的 dsh `0.1.6-alpha.2` web profile 没有该服务。仅界面中的自动化页面不代表服务已安装；本包不额外安装定时服务，也不承诺夜间自动整理。

本轮未执行真实安装、重复安装、模型整理及人格预设可见性验收；环境不具备，交回维护者。安装失败只提示「其余功能不受影响」，不以非零状态退出。

## 卸载

```powershell
dsh plugin --profile web remove dsh-memory
```

随后重启 dsh。安装器和卸载命令不主动删除记忆数据；需要保留时先备份 `$DSH_HOME/memory/`。

## 包内容

```text
install.bat
README.md
mods/memory/             # 原样的 lib、src、bundle patch、manifest、README 和 VERSION.txt
```
