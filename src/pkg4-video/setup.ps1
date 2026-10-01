# -*- coding: utf-8 -*-
# ============================================================
#  包4 · 视频理解 一键安装
#  前提: 已装 包1 (核心包) 且 dsh web 能正常起
#  用法: 双击 install.bat
#  功能: 爱莉看视频 (内容总结/抽帧/场景检测/GIF/元数据)
#  依赖: ffmpeg + ffprobe 必须在系统 PATH (脚本检查并给指引, 不自动装)
# ============================================================
$ErrorActionPreference = 'Stop'
$Cyan = 'Cyan'; $Green = 'Green'; $Yellow = 'Yellow'; $Pink = 'Magenta'
function Say($m, $c = $Cyan) { Write-Host "  $m" -ForegroundColor $c }

Say '══════════════════════════════════════' $Pink
Say '  爱莉视频理解 · 一键安装' $Pink
Say '══════════════════════════════════════' $Pink
Say ''

$base = 'D:\AI\JARVIS'
$scriptDir = $args[0].TrimEnd('\')
New-Item -ItemType Directory -Path $base -Force | Out-Null

# ---------- [1/4] 环境检查 ----------
Say '[1/4] 检查环境 ...'
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

# ffmpeg / ffprobe 是视频功能的命根子: 没有它插件照样加载, 但工具一调就报错。
# 只提示不自动装 —— ffmpeg 体积大、装法多、自动装容易翻车, 让用户手动。
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
$fp = Get-Command ffprobe -ErrorAction SilentlyContinue
if (-not $ff -or -not $fp) {
    Say '' $Yellow
    Say '  未检测到 ffmpeg / ffprobe —— 视频功能必须依赖它!' $Yellow
    Say '  没有的话: 插件能装上, 但抽帧/GIF/总结类工具一用就报错。' $Yellow
    Say '  请手动安装 (二选一):' $Yellow
    Say '    1. 新开一个命令行窗口执行:  winget install Gyan.FFmpeg' $Yellow
    Say '       装完要重开窗口 (让 PATH 生效)' $Yellow
    Say '    2. 或到 https://www.gyan.dev/ffmpeg/builds/ 下载' $Yellow
    Say '       release-essentials.zip, 解压后把里面的 bin 目录加进系统 PATH' $Yellow
    Say '  已装好就按回车继续; 想以后再装就直接关掉本窗口。' $Yellow
    Read-Host '按回车继续'
    $ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
    $fp = Get-Command ffprobe -ErrorAction SilentlyContinue
}
if ($ff -and $fp) {
    # 上古 ffmpeg (比如 2013 年的) 能跑, 但手机拍的 HEVC/H.265 视频解不动, 提前提醒
    $ver = (& ffmpeg -version | Select-Object -First 2) -join ' '
    $major = $null; $builtYear = $null
    if ($ver -match 'version\s+(\d+)\.') { $major = [int]$Matches[1] }
    if ($ver -match 'built on .*?(\d{4})') { $builtYear = [int]$Matches[1] }
    if (($null -ne $major -and $major -lt 4) -or ($null -eq $major -and $null -ne $builtYear -and $builtYear -lt 2019)) {
        Say "  !! 检测到很老的 ffmpeg: $($ver.Substring(0, [Math]::Min(70, $ver.Length)))" $Yellow
        Say '     常规视频能用, 但手机拍的 HEVC/H.265 会解不动 (抽帧失败)。' $Yellow
        Say '     建议换新版: winget install Gyan.FFmpeg (注意让新版盖过旧版 PATH)' $Yellow
    } else {
        Say '  OK ffmpeg 已就位' $Green
    }
} else {
    Say '  !! ffmpeg 仍未检测到 —— 先继续装插件, 视频功能暂不可用。' $Yellow
    Say '     以后装好 ffmpeg 重启 dsh web 即可, 不用重跑本包。' $Yellow
}

# ---------- [2/4] 复制插件 ----------
Say '[2/4] 复制插件 ...'
$pluginDir = Join-Path $base 'dsh-video-frames'
New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null
Copy-Item (Join-Path $scriptDir 'plugin\*') $pluginDir -Recurse -Force
Say '  OK 已复制到 D:\AI\JARVIS\dsh-video-frames' $Green

# ---------- [3/4] 安装插件依赖 ----------
# 插件必须自带一份 node_modules: dsh 的 profile 只装 bundle 自身,
# 不提供插件要用的 @deepseek-ai/* 包, 靠 profile 是解析不到的。
Say '[3/4] 安装插件依赖 (联网, 约 1 分钟) ...'
Push-Location $pluginDir
cmd /c "npm install --no-audit --no-fund >nul 2>&1"
$npmOk = ($LASTEXITCODE -eq 0) -and (Test-Path (Join-Path $pluginDir 'node_modules'))
Pop-Location
if ($npmOk) {
    Say '  OK 依赖已就位' $Green
} else {
    Say '  !! 依赖没装上, 插件会加载失败' $Yellow
    Say '     手动重试: cd D:\AI\JARVIS\dsh-video-frames && npm install' $Yellow
}

# ---------- [4/4] 装进 DSH ----------
# 本插件不需要往 profile 的 cordis.patch.yml 写配置 (不像 QQ 桥要 token/cwd),
# bundle patch 由插件自带的 cordis.patch.yml 提供。
Say '[4/4] 把插件装进 DSH (profile: web) ...'
$pluginDirSlash = $pluginDir.Replace('\', '/')
cmd /c "dsh plugin --profile web add `"$pluginDirSlash`" 2>&1"
if ($LASTEXITCODE -ne 0) {
    Say '  !! 装进 DSH 失败 (上面有报错, 可复制给作者)' $Yellow
} else {
    Say '  OK 插件已进 web profile' $Green
}

Say ''
Say '  装完了:' $Green
Say '  1. 重启 dsh web: 关掉它的窗口, 再双击桌面的 start-elysia.bat' $Green
Say '  2. 浏览器打开 http://127.0.0.1:3080, 直接对爱莉说:' $Green
Say '     "帮我看下 D:\videos\xxx.mp4 里发生了什么"' $Green
Say '     "把这段视频做成 GIF" / "这个视频多长、什么分辨率"' $Green
Say '  详细见包里的 README.md' $Green
Say ''
Read-Host '按回车关闭'
