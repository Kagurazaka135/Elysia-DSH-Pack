# -*- coding: utf-8 -*-
# ============================================================
#  包3 · QQ 扩展 一键安装
#  前提: 已装 包1 (DeepSeek Harness)
#  用法: 双击 install.bat -> 自动完成 -> 扫码登录小号
#  功能: QQ 私聊/群聊 (文字+语音), 任务直通
# ============================================================
$ErrorActionPreference = 'Stop'
$Cyan = 'Cyan'; $Green = 'Green'; $Yellow = 'Yellow'; $Pink = 'Magenta'
function Say($m, $c = $Cyan) { Write-Host "  $m" -ForegroundColor $c }

Say '══════════════════════════════════════' $Pink
Say '  爱莉 QQ 扩展 · 一键安装' $Pink
Say '══════════════════════════════════════' $Pink
Say ''

$base = 'D:\AI\JARVIS'
$dshHome = Join-Path $env:USERPROFILE '.dsh'
$scriptDir = $args[0].TrimEnd('\')
New-Item -ItemType Directory -Path $base -Force | Out-Null

# ---------- [1/5] 环境检查 ----------
Say '[1/5] 检查环境 ...'
if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
    Say '  未检测到 DSH, 请先安装 包1 (核心包)!' $Yellow
    Read-Host '按回车退出'; exit 1
}
# dsh 的插件管理内部转发给 pnpm, 没有 pnpm 会直接失败 (exit 127)
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Say '  未检测到 pnpm, 正在安装 ...' $Yellow
    cmd /c "npm install -g pnpm >nul 2>&1"
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Say '  !! pnpm 装不上, 请手动执行: npm install -g pnpm' $Yellow
        Read-Host '按回车退出'; exit 1
    }
}
Say '  OK dsh + pnpm 都在' $Green

# ---------- [2/5] 复制脚本与插件 ----------
Say '[2/5] 复制脚本与插件 ...'
Copy-Item (Join-Path $scriptDir 'qq-elysia.py') (Join-Path $base 'qq-elysia.py') -Force
New-Item -ItemType Directory -Path (Join-Path $base 'tasks') -Force | Out-Null

$pluginDir = Join-Path $base 'dsh-qq-bridge'
New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null
Copy-Item (Join-Path $scriptDir 'plugin\*') $pluginDir -Recurse -Force
Say '  OK 已复制到 D:\AI\JARVIS' $Green

# ---------- [3/5] 安装插件依赖 ----------
# 插件必须自带一份 node_modules: dsh 的 profile 只装 bundle 自身,
# 不提供插件要用的 @deepseek-ai/* 包, 靠 profile 是解析不到的。
Say '[3/5] 安装插件依赖 (联网, 约 1 分钟) ...'
Push-Location $pluginDir
cmd /c "npm install --no-audit --no-fund >nul 2>&1"
$npmOk = ($LASTEXITCODE -eq 0) -and (Test-Path (Join-Path $pluginDir 'node_modules'))
Pop-Location
if ($npmOk) {
    Say '  OK 依赖已就位' $Green
} else {
    Say '  !! 依赖没装上, 插件会加载失败' $Yellow
    Say '     手动重试: cd D:\AI\JARVIS\dsh-qq-bridge && npm install' $Yellow
}

# ---------- [4/5] 装进 DSH ----------
Say '[4/5] 把插件装进 DSH (profile: web) ...'
$pluginDirSlash = $pluginDir.Replace('\', '/')
cmd /c "dsh plugin --profile web add `"$pluginDirSlash`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Say '  !! 装进 DSH 失败 (上面有报错, 可复制给作者)' $Yellow
} else {
    Say '  OK 插件已进 web profile' $Green
}

# 往 profile 写插件配置 (token 留空 = 本机不校验; 要收紧就在两边都填同一个值)
$patchPath = Join-Path $dshHome 'profiles\web\cordis.patch.yml'
if (Test-Path $patchPath) {
    $content = Get-Content $patchPath -Raw -Encoding UTF8
    if ($content -notmatch 'dsh-qq-bridge') {
        $content = ($content -replace '(?m)^\[\]\s*$', '').TrimEnd()
        $content += "`n- id: dsh-qq-bridge`n  config:`n    agentPreset: 'elysia'`n    cwd: 'D:/AI/JARVIS'`n"
        Set-Content -Path $patchPath -Value $content -Encoding UTF8
        Say '  OK 插件配置已写入 profile' $Green
    } else {
        Say '  OK 插件配置已存在, 跳过' $Green
    }
} else {
    Say '  未找到 profile 配置, 请先运行一次 dsh web 再重跑本包' $Yellow
}

# ---------- [5/5] NapCat ----------
Say '[5/5] NapCat (QQ 协议) ...'
$napcatDir = Join-Path $base 'napcat'
if (Test-Path (Join-Path $napcatDir 'napcat.bat')) {
    Say '  OK 已存在' $Green
} else {
    Say '  需要下载 NapCat (约 110MB):' $Yellow
    Say '  https://github.com/NapNeko/NapCatQQ/releases' $Yellow
    Say '  下载 NapCat.Shell.Windows.Node.zip 解压到:' $Yellow
    Say "  $napcatDir" $Yellow
    Read-Host '下载解压完成后按回车继续'
}
$configDir = Join-Path $napcatDir 'napcat\config'
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$onebotPath = Join-Path $configDir 'onebot11.json'
if (-not (Test-Path $onebotPath)) {
    @'
{
  "network": {
    "websocketServers": [
      {
        "enable": true,
        "name": "elysia-ws",
        "host": "127.0.0.1",
        "port": 3001,
        "messagePostFormat": "array",
        "reportSelfMessage": false,
        "token": ""
      }
    ]
  }
}
'@ | Set-Content -Path $onebotPath -Encoding UTF8
}
Say '  OK OneBot 配置已写入 (端口 3001)' $Green

$launcher = Join-Path $napcatDir 'napcat\launcher.bat'
if (Test-Path $launcher) {
    Start-Process cmd -ArgumentList "/c","cd /d $napcatDir\napcat && launcher.bat" -Verb RunAs
    Say '  已启动 (如有 UAC 弹窗请点是), 请用 QQ 小号扫码登录' $Yellow
} else {
    Say '  未找到 launcher.bat, 请检查 NapCat 解压路径' $Yellow
}

Say ''
Say '  登录完成后:' $Green
Say '  1. 确保 dsh 在跑 (双击桌面的 start-elysia.bat)' $Green
Say '  2. 运行分身: python D:\AI\JARVIS\qq-elysia.py' $Green
Say '  3. 大号加小号好友 -> 发消息 = 和爱莉聊天' $Green
Say '  详细见 README.md' $Green
Say ''
Read-Host '按回车关闭'
