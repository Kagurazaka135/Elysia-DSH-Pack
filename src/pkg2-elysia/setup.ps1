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

# UTF-8 无 BOM 写入: PS5.1 的 Add-Content -Encoding UTF8 会把 BOM 混进已有文件,
# YAML 解析器对中间冒出来的 BOM 不一定容忍 —— 统一读进来追加再用无 BOM 写回
$script:utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Say '══════════════════════════════════════' $Pink
Say '  爱莉希雅 · 人格与语音安装' $Pink
Say '══════════════════════════════════════' $Pink
Say ''

$dshHome = Join-Path $env:USERPROFILE '.dsh'
$scriptDir = ($args[0] -replace '"', '').TrimEnd('\')

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
$composePath = Join-Path $presetDir 'agent.cordis.yml'
if (Test-Path (Join-Path $presetSrc 'agent.cordis.yml')) {
    Copy-Item (Join-Path $presetSrc '*') $presetDir -Recurse -Force
    Say '  OK 人格预设已安装 (新会话可选 elysia)' $Green
} else {
    Say '  未找到 preset 目录, 包可能不完整' $Yellow
}

# 2b. 按本机 dsh 版本校准预设里的插件行
#   预设里的 workflow 行是按 0.1.6 写的 (@deepseek-ai/dsh-workflow-ptc), 而 0.1.5.x
#   上只有 @deepseek-ai/dsh-workflow-worker-thread。名字对不上时 DSH 会把整个预设
#   标成「加载失败」(红色标签, 选都选不了), 所以这里按实际装了的包换名。
#
#   A9 实测 (0.1.6-alpha.2 + npm v11 全局安装): 依赖不提升到顶层, 全在嵌套层
#   <npm root -g>\@deepseek-ai\dsh\node_modules\@deepseek-ai\ (259 个包),
#   顶层只有 dsh 本体。但 npm 版本/安装方式 (pnpm、nvm shim) 不同布局会变 ——
#   探测按候选列表兜底: 嵌套层 -> 全局顶层 -> 按 dsh 命令位置推 -> pnpm 全局;
#   自检时包在任何候选命中都算「有」, 不再因为一层没探到就整体静默跳过。
$roots = New-Object System.Collections.Generic.List[string]
function Add-Root([string]$r) {
    if ($r) { $t = $r.Trim(); if ($t -and (Test-Path $t)) { $script:roots.Add($t) } }
}
$npmRootG = (cmd /c "npm root -g 2>nul" | Select-Object -Last 1)
if ($npmRootG) {
    Add-Root (Join-Path $npmRootG.Trim() '@deepseek-ai\dsh\node_modules')   # 嵌套布局 (实测主路径)
    Add-Root $npmRootG.Trim()                                               # 顶层提升布局
}
if ($dsh.Source) {
    $npmBin = Split-Path $dsh.Source -Parent      # 兜底: 按 dsh 命令 shim 的位置推 (nvm 等)
    Add-Root (Join-Path $npmBin 'node_modules\@deepseek-ai\dsh\node_modules')
    Add-Root (Join-Path $npmBin 'node_modules')
}
Add-Root ((cmd /c "pnpm root -g 2>nul" | Select-Object -Last 1))
Add-Root ((cmd /c "pnpm root -g 2>nul" | Select-Object -Last 1) + '\@deepseek-ai\dsh\node_modules')
$roots = @($roots | Select-Object -Unique)

if ($roots.Count -gt 0 -and (Test-Path $composePath)) {
    $yml = [IO.File]::ReadAllText($composePath)
    $hasPtc = $false; $hasWorker = $false
    foreach ($r in $roots) {
        if (Test-Path (Join-Path $r '@deepseek-ai\dsh-workflow-ptc')) { $hasPtc = $true }
        if (Test-Path (Join-Path $r '@deepseek-ai\dsh-workflow-worker-thread')) { $hasWorker = $true }
    }
    if (-not $hasPtc -and $hasWorker -and $yml.Contains('dsh-workflow-ptc')) {
        $yml = $yml.Replace('- id: workflow-ptc', '- id: workflow-worker-thread').Replace('@deepseek-ai/dsh-workflow-ptc', '@deepseek-ai/dsh-workflow-worker-thread')
        [IO.File]::WriteAllText($composePath, $yml, $script:utf8NoBom)
        Say '  OK 已适配本机 dsh: workflow-ptc -> workflow-worker-thread' $Green
    } elseif ($hasPtc) {
        Say '  OK 本机 dsh 自带 ptc workflow, 预设无需改动' $Green
    }

    # 自检: 预设里每一行引用的包, 本机是不是真的装了 (装不上会显示「加载失败」)
    $missing = @()
    foreach ($m in [regex]::Matches($yml, "name:\s*'(@[^']+)'")) {
        $spec = $m.Groups[1].Value
        $pkg = ($spec.Split('/')[0..1] -join '/')
        $found = $false
        foreach ($r in $roots) {
            if (Test-Path (Join-Path $r ($pkg -replace '/', '\'))) { $found = $true; break }
        }
        if (-not $found) { $missing += $spec }
    }
    $missing = @($missing | Sort-Object -Unique)
    if ($missing.Count -gt 0) {
        Say '  注意: 以下插件行引用的包本机没有, 预设会显示「加载失败」:' $Yellow
        foreach ($n in $missing) { Say "    - $n" $Yellow }
        Say '  多半是 dsh 版本与预设不匹配 —— 包1 钉的是 0.1.6-alpha.2' $Yellow
    } else {
        Say '  OK 预设引用的插件本机都有 (不会有「加载失败」)' $Green
    }
} else {
    Say '  跳过版本自检 (没找到 dsh 的 node_modules)' $Yellow
}

# 3. 语音 (CosyVoice 可选, 体积大)
Say '[3/3] 语音部分 ...'
Say '  注意: 声线素材 wav 未随包分发 (游戏配音素材, 版权原因)' $Yellow
Say '        需要的话从原整合包处获取, 放本包 voice-clips/ 即可' $Yellow
Say '  CosyVoice 模型(约3GB) 需手动下载:' $Yellow
Say '    1. https://modelscope.cn/models/iic/CosyVoice2-0.5B'
Say '    2. 模型解压到 D:\AI\JARVIS\models\cosyvoice2\'
Say '    3. 声线文件放 D:\AI\JARVIS\models\elysia-voice\clips\guide-elysia\'
Say '  详细步骤见 docs\voice-guide.md (跟分身 qq-elysia.py 找的路径一致)' $Yellow

# 设置默认预设为 elysia
#   注意: settings.yaml 里往往已经有 agent-presets 段 (Web 设置页写过默认值),
#   旧版脚本看到这个键就直接跳过, 于是默认值一直停在 standard —— 这里改成改写它。
$settingsPath = Join-Path $dshHome 'settings.yaml'
if (-not (Test-Path $settingsPath)) {
    Say '  未找到 settings.yaml, 跳过默认预设 (请先装包1 并启动一次 dsh)' $Yellow
} else {
    Copy-Item $settingsPath "$settingsPath.bak-pkg2" -Force
    $raw = [IO.File]::ReadAllText($settingsPath)
    $eol = if ($raw -match "`r`n") { "`r`n" } else { "`n" }
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.AddRange([string[]]($raw -split "`r?`n"))
    $hdr = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^agent-presets:\s*$') { $hdr = $i; break }
    }
    if ($hdr -lt 0) {
        if ($raw.Length -gt 0 -and -not $raw.EndsWith($eol)) { $lines.Add('') }
        $lines.Add('agent-presets:')
        $lines.Add('  default: elysia')
        $how = '新增 agent-presets 段'
    } else {
        $defIdx = -1; $indent = '  '; $comment = ''
        for ($i = $hdr + 1; $i -lt $lines.Count; $i++) {
            $l = $lines[$i]
            if ($l -match '^\S') { break }          # 下一段的开头, 本段结束
            if ($l -match '^\s*$') { continue }
            if ($l -match '^(\s*)default:') { $defIdx = $i; $indent = $Matches[1]; break }
        }
        if ($defIdx -ge 0) {
            if ($lines[$defIdx] -match '#(.*)$') { $comment = '  #' + $Matches[1] }
            $lines[$defIdx] = "$indent" + 'default: elysia' + $comment
            $how = '改写已有的 default'
        } else {
            $lines.Insert($hdr + 1, '  default: elysia')
            $how = '补上缺失的 default'
        }
    }
    [IO.File]::WriteAllText($settingsPath, ($lines -join $eol), $script:utf8NoBom)
    Say "  已设置默认预设 = elysia ($how; 旧文件备份为 settings.yaml.bak-pkg2)" $Green
}

Say ''
Say '  完成! 新会话默认就是爱莉希雅 (想写代码时再手动切 standard)' $Green
Say '  已开着的网页刷新一下 (F5) 就能看到预设; 没在跑就双击桌面 start-elysia.bat' $Green
Say ''
Read-Host '按回车关闭'
