# -*- coding: utf-8 -*-
# ============================================================
#  包3 · QQ 扩展 一键安装
#  前提: 已装 包1 (DeepSeek Harness)
#  用法: 双击 install.bat -> 自动完成 -> 扫码登录小号
#  功能: QQ 私聊/群聊 (文字+语音), 任务直通
#  安全: 安装时生成白名单+共享口令 (D:\AI\JARVIS\qq-config.json),
#        同一份值同步进 profile 插件配置和 NapCat onebot11.json
# ============================================================
$ErrorActionPreference = 'Stop'
$Cyan = 'Cyan'; $Green = 'Green'; $Yellow = 'Yellow'; $Pink = 'Magenta'
function Say($m, $c = $Cyan) { Write-Host "  $m" -ForegroundColor $c }

# UTF-8 无 BOM 写入: PS5.1 的 Set-Content -Encoding UTF8 带 BOM,
# NapCat/Node 的 JSON.parse 读到 BOM 会炸 —— 所有配置文件统一走这里 (P3-4)
$script:utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-NoBom($path, $content) {
    [IO.File]::WriteAllText($path, $content, $script:utf8NoBom)
}
function New-HexToken {
    -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
}

Say '══════════════════════════════════════' $Pink
Say '  爱莉 QQ 扩展 · 一键安装' $Pink
Say '══════════════════════════════════════' $Pink
Say ''

$base = 'D:\AI\JARVIS'
$dshHome = Join-Path $env:USERPROFILE '.dsh'
$scriptDir = ($args[0] -replace '"', '').TrimEnd('\')
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

# ---------- [2.5/5] 安全配置: 白名单 + 共享口令 ----------
# 三方同源: qq-elysia.py / profile 插件配置 / NapCat onebot11.json 用同一份值。
# 已有 qq-config.json 时增量合并 (用户改过的白名单/口令不覆盖)。
Say '[2.5/5] 安全配置 (白名单 + 口令) ...'
$cfgPath = Join-Path $base 'qq-config.json'
$cfgUsers = @(); $cfgGroups = @()
$injectToken = ''; $wsToken = ''; $botQq = ''
if (Test-Path $cfgPath) {
    try {
        $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($cfg.inject_token) { $injectToken = [string]$cfg.inject_token }
        if ($cfg.ws_token)     { $wsToken = [string]$cfg.ws_token }
        if ($cfg.bot_qq)       { $botQq = [string]$cfg.bot_qq }
        if ($cfg.allowed_users)     { $cfgUsers  = @(@($cfg.allowed_users)      | ForEach-Object { [string]$_ }) }
        if ($cfg.allowed_group_ids) { $cfgGroups = @(@($cfg.allowed_group_ids)  | ForEach-Object { [string]$_ }) }
    } catch { Say '  qq-config.json 读不出来, 按全新安装处理' $Yellow }
}
if (-not $injectToken) { $injectToken = New-HexToken }
if (-not $wsToken)     { $wsToken = New-HexToken }

# 白名单必填: 空名单 = 分身侧 fail-closed, 爱莉谁都不理
if ($cfgUsers.Count -eq 0) {
    Say '  [安全] 谁能跟爱莉说话? 只有名单里的 QQ 号会被放行' $Yellow
    $raw = ''
    while ($raw -eq '') {
        $raw = (Read-Host '  允许的 QQ 号 (多个用逗号隔开, 比如 123456,654321)').Trim()
        $raw = $raw -replace '，', ','
        if ($raw -eq '') { Say '  不能留空 —— 白名单空着爱莉谁都不理' $Yellow }
    }
    $cfgUsers = @($raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' })
}
if (-not $botQq) {
    $in = (Read-Host '  爱莉小号的 QQ 号 (回车 = 2778339130)').Trim()
    $botQq = if ($in -ne '') { $in } else { '2778339130' }
}
$allowedJoined = ($cfgUsers -join ',')
Say "  OK 白名单: $allowedJoined" $Green

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

# 往 profile 写插件配置: token + 白名单 + 预设, 值全部来自上面的安全配置段
$patchPath = Join-Path $dshHome 'profiles\web\cordis.patch.yml'
$block = "- id: dsh-qq-bridge`n  config:`n    agentPreset: 'elysia'`n    cwd: 'D:/AI/JARVIS'`n    token: '$injectToken'`n    allowedUsers: '$allowedJoined'`n"
if (Test-Path $patchPath) {
    $content = Get-Content $patchPath -Raw -Encoding UTF8
    if ($content -match 'allowedUsers:') {
        Say '  OK 插件配置已含白名单, 跳过 (要改就编辑 profile 的 cordis.patch.yml)' $Green
    } elseif ($content -match 'dsh-qq-bridge') {
        # 已有本插件的块但没配白名单 -> 整块重写成带安全字段的新块
        $newContent = [regex]::Replace($content, '(?ms)^[ \t]*-[ \t]*id:[ \t]*dsh-qq-bridge\b.*?(?=^[ \t]*-[ \t]*id:|\z)', $block)
        Write-NoBom $patchPath $newContent
        Say '  OK 已把 token/白名单补进插件配置' $Green
    } else {
        $content = ($content -replace '(?m)^\[\]\s*$', '').TrimEnd()
        $content += "`n$block"
        Write-NoBom $patchPath $content
        Say '  OK 插件配置已写入 profile' $Green
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
    Say '  尝试自动下载 NapCat (约 110MB, 慢的话耐心等) ...' $Yellow
    $zipPath = Join-Path $env:TEMP 'NapCat.Shell.Windows.Node.zip'
    $dlOk = $false
    try {
        $ProgressPreference = 'SilentlyContinue'   # 不关这个, PS5.1 的下载进度条慢得离谱
        Invoke-WebRequest -Uri 'https://github.com/NapNeko/NapCatQQ/releases/latest/download/NapCat.Shell.Windows.Node.zip' -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
        $ProgressPreference = 'Continue'
        if ((Get-Item $zipPath).Length -gt 50MB) { $dlOk = $true }
        else { Say '  下载的文件不对劲 (太小), 当作失败' $Yellow }
    } catch {
        $ProgressPreference = 'Continue'
        Say "  自动下载失败: $($_.Exception.Message)" $Yellow
    }
    if ($dlOk) {
        try {
            Say '  解压中 ...'
            Expand-Archive -Path $zipPath -DestinationPath $napcatDir -Force
            Say '  OK NapCat 已就位' $Green
        } catch {
            Say "  解压失败: $($_.Exception.Message)" $Yellow
        }
    }
    if (-not (Test-Path (Join-Path $napcatDir 'napcat.bat'))) {
        Say '  请手动下载 NapCat (约 110MB):' $Yellow
        Say '  https://github.com/NapNeko/NapCatQQ/releases' $Yellow
        Say '  下载 NapCat.Shell.Windows.Node.zip 解压到:' $Yellow
        Say "  $napcatDir" $Yellow
        Read-Host '下载解压完成后按回车继续'
    }
}
$configDir = Join-Path $napcatDir 'napcat\config'
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$onebotPath = Join-Path $configDir 'onebot11.json'
$ob = $null; $srv = $null; $existingToken = ''
if (Test-Path $onebotPath) {
    try {
        $ob = Get-Content $onebotPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $srv = @($ob.network.websocketServers)[0]
        $existingToken = [string]$srv.token
    } catch {
        $ob = $null
        Say '  onebot11.json 读不出来, 之后会重建一份' $Yellow
    }
}
if ($existingToken -ne '') {
    if ($existingToken -cne $wsToken) {
        # NapCat 文件里已配过别的口令 -> 以文件为准 (它是实际生效的), 回写进共享配置分身才连得上
        $wsToken = $existingToken
    }
    Say '  OK OneBot 配置已存在 (token 沿用文件里的)' $Green
} elseif ($ob -ne $null -and $ob.network -ne $null -and @($ob.network.websocketServers).Count -gt 0) {
    # 老用户: 配置在、token 空 -> 原地补 token, 不动其他字段
    $srv = @($ob.network.websocketServers)[0]
    $srv | Add-Member -NotePropertyName token -NotePropertyValue $wsToken -Force
    Write-NoBom $onebotPath ($ob | ConvertTo-Json -Depth 10)
    Say '  OK 已给现有 onebot11.json 补上 token' $Green
} else {
    $onebotJson = @"
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
        "token": "$wsToken"
      }
    ]
  }
}
"@
    Write-NoBom $onebotPath $onebotJson
    Say '  OK OneBot 配置已写入 (端口 3001, 已带 token)' $Green
}

$launcher = Join-Path $napcatDir 'napcat\launcher.bat'
if (Test-Path $launcher) {
    Start-Process cmd -ArgumentList "/c","cd /d $napcatDir\napcat && launcher.bat" -Verb RunAs
    Say '  已启动 (如有 UAC 弹窗请点是), 请用 QQ 小号扫码登录' $Yellow
} else {
    Say '  未找到 launcher.bat, 请检查 NapCat 解压路径' $Yellow
}

# ---------- 收尾: 落盘共享配置 ----------
# 放最后: ws_token 可能刚被 onebot11.json 里的既有值覆盖
$cfgOut = [ordered]@{
    inject_token = $injectToken
    ws_token = $wsToken
    allowed_users = $cfgUsers
    allowed_group_ids = $cfgGroups
    bot_qq = $botQq
}
Write-NoBom $cfgPath ($cfgOut | ConvertTo-Json -Depth 5)
Say '  OK 共享配置已写入 qq-config.json (分身/插件/NapCat 同源)' $Green

Say ''
Say '  登录完成后:' $Green
Say '  1. 确保 dsh 在跑 (双击桌面的 start-elysia.bat)' $Green
Say '  2. 运行分身: python D:\AI\JARVIS\qq-elysia.py' $Green
Say "  3. 白名单里的号加小号好友 -> 发消息 = 和爱莉聊天" $Green
Say '  详细见 README.md' $Green
Say ''
Read-Host '按回车关闭'
