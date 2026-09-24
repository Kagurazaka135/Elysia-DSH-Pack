# -*- coding: utf-8 -*-
# ============================================================
#  包2 · 爱莉人格 + 语音 一键安装
#  前提: 已装 包1 (DeepSeek Harness)
#  用法: 双击 install.bat -> 自动完成
#  包含: 爱莉人格预设 + 第一版声线 (CosyVoice)
# ============================================================
$ErrorActionPreference = 'Stop'
$Cyan = 'Cyan'; $Green = 'Green'; $Yellow = 'Yellow'; $Pink = 'Magenta'
function Say($m, $c = $Cyan) { Write-Host "  $m" -ForegroundColor $c }

Say '══════════════════════════════════════' $Pink
Say '  爱莉希雅 · 人格与语音安装' $Pink
Say '══════════════════════════════════════' $Pink
Say ''

$dshHome = Join-Path $env:USERPROFILE '.dsh'
$scriptDir = $args[0].TrimEnd('\')

# 1. 检查 DSH
Say '[1/3] 检查 DeepSeek Harness ...'
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dsh) {
    Say '  未检测到 DSH, 请先安装 包1 (核心包)!' $Yellow
    Read-Host '按回车退出'; exit 1
}
Say '  OK' $Green

# 2. 安装人格预设
Say '[2/3] 安装爱莉人格 ...'
$presetDir = Join-Path $dshHome '.agent-presets\elysia'
New-Item -ItemType Directory -Path $presetDir -Force | Out-Null
$presetSrc = Join-Path $scriptDir 'preset'
if (Test-Path (Join-Path $presetSrc 'agent.cordis.yml')) {
    Copy-Item (Join-Path $presetSrc '*') $presetDir -Recurse -Force
    Say '  OK 人格预设已安装 (新会话可选 elysia)' $Green
} else {
    Say '  未找到 preset 目录, 包可能不完整' $Yellow
}

# 3. 语音 (CosyVoice 可选, 体积大)
Say '[3/3] 语音部分 ...'
Say '  注意: 声线素材 wav 未随包分发 (游戏配音素材, 版权原因)' $Yellow
Say '        需要的话从原整合包处获取, 放本包 voice-clips/ 即可' $Yellow
Say '  CosyVoice 模型(约3GB) 需手动下载:' $Yellow
Say '    1. https://modelscope.cn/models/iic/CosyVoice2-0.5B'
Say '    2. 解压到 D:\CosyVoice\pretrained_models\'
Say '    3. 声线文件放 D:\CosyVoice\elysia-voice\clips\'
Say '  详细步骤见 README.md 第 3 节' $Yellow

# 设置默认预设为 elysia
$settingsPath = Join-Path $dshHome 'settings.yaml'
if (Test-Path $settingsPath) {
    $content = Get-Content $settingsPath -Raw -Encoding UTF8
    if ($content -notmatch 'agent-presets') {
        Add-Content $settingsPath "`nagent-presets:`n  default: elysia`n" -Encoding UTF8
        Say '  已设置默认预设 = elysia' $Green
    }
}

Say ''
Say '  完成! 重启 DSH (关掉窗口重新 dsh web)' $Green
Say '  新会话选择 elysia 预设 -> 爱莉就在等你啦!' $Green
Say ''
Read-Host '按回车关闭'
