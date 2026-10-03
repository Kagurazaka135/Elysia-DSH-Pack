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
    # CSPRNG (D1): 旧的 Get-Random 是 System.Random, 时间种子可被离线枚举复现。
    $b = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    ($b | ForEach-Object { $_.ToString('x2') }) -join ''
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
    while ($cfgUsers.Count -eq 0) {
        $raw = (Read-Host '  允许的 QQ 号 (多个用逗号隔开, 比如 123456,654321)').Trim()
        $raw = $raw -replace '，', ','
        $cfgUsers = @($raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' })
        # A7: 全非数字过滤后为空要重问, 别拿着空名单往下走 (装完谁都不理, 还以为坏了)
        if ($cfgUsers.Count -eq 0) { Say '  没认出有效的 QQ 号 (只收数字), 再来一次' $Yellow }
        $dropped = @($raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^\d+$' })
        if ($dropped.Count -gt 0) { Say "  已忽略非数字输入: $($dropped -join ', ')" $Yellow }
    }
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

# ---------- [3.5/5] Python 依赖: websockets (A4) ----------
# 分身用 websockets 连 NapCat。v13 及以下的参数名是 extra_headers, v14+ 才是
# additional_headers —— 钉 >=14 让分身走新分支; 装不上只警告 (分身代码里有
# 特征分支兜底, v13 也能连)。
Say '[3.5/5] 检查 Python websockets ...'
$wsVer = cmd /c "python -c ""import websockets;print(getattr(websockets,'__version__','0'))"" 2>nul"
$needWs = $true
if ($LASTEXITCODE -eq 0 -and $wsVer) {
    $maj = ($wsVer.ToString().Trim() -split '\.')[0] -as [int]
    if ($maj -ge 14) { $needWs = $false; Say "  OK websockets $wsVer" $Green }
}
if ($needWs) {
    Say '  安装 websockets (>=14, 分身连 NapCat 要用) ...' $Yellow
    cmd /c "python -m pip install --upgrade websockets --disable-pip-version-check --quiet >nul 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Say '  OK websockets 已就位' $Green
    } else {
        Say '  !! websockets 没装上 (没检测到 python 或 pip 失败)' $Yellow
        Say '     手动执行: python -m pip install "websockets>=14"' $Yellow
    }
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

# 往 profile 写插件配置: 只是 qq-config.json 缺失时的兜底 (插件以 qq-config.json
# 为唯一真源, A1)。token + 白名单 + 预设, 值全部来自上面的安全配置段
$patchPath = Join-Path $dshHome 'profiles\web\cordis.patch.yml'
$block = "- id: dsh-qq-bridge`n  config:`n    agentPreset: 'elysia'`n    cwd: 'D:/AI/JARVIS'`n    configPath: 'D:/AI/JARVIS/qq-config.json'`n    token: '$injectToken'`n    allowedUsers: '$allowedJoined'`n"
if (Test-Path $patchPath) {
    $content = Get-Content $patchPath -Raw -Encoding UTF8
    if ($content -match 'allowedUsers:') {
        Say '  OK 插件兜底配置已存在, 跳过 (插件实际读 D:\AI\JARVIS\qq-config.json, 改那个就行)' $Green
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
# 供应链 (D6): 钉死 release tag + sha256 (GitHub release 资产的官方 digest),
# 不再用 latest。"下载失败"和"校验不符"分开报; 校验不过绝不落盘解压。
# 升级 NapCat 时: 两个常量一起换 (digest 用
#   curl -s https://api.github.com/repos/NapNeko/NapCatQQ/releases/tags/<tag> 看 assets[].digest)。
$napcatTag = 'v4.18.28'
$napcatSha256 = 'fb64fa3b036ad2df1a5d7c204c482694c20e4b763978c8a4968fd3474c05b4a8'
Say "[5/5] NapCat (QQ 协议, 钉 $napcatTag) ..."
$napcatDir = Join-Path $base 'napcat'
if (Test-Path (Join-Path $napcatDir 'napcat.bat')) {
    Say '  OK 已存在' $Green
} else {
    Say "  自动下载 NapCat $napcatTag (约 110MB, 慢的话耐心等) ..." $Yellow
    $zipPath = Join-Path $env:TEMP 'NapCat.Shell.Windows.Node.zip'
    $dlOk = $false
    try {
        $ProgressPreference = 'SilentlyContinue'   # 不关这个, PS5.1 的下载进度条慢得离谱
        Invoke-WebRequest -Uri "https://github.com/NapNeko/NapCatQQ/releases/download/$napcatTag/NapCat.Shell.Windows.Node.zip" -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
        $ProgressPreference = 'Continue'
        $dlOk = $true
    } catch {
        $ProgressPreference = 'Continue'
        Say "  自动下载失败: $($_.Exception.Message)" $Yellow
    }
    $hashOk = $false
    if ($dlOk) {
        $got = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
        if ($got -eq $napcatSha256) {
            $hashOk = $true
            Say '  OK sha256 校验通过' $Green
        } else {
            # 坏包绝不解压: 删掉, 落到下面的手动指引
            Say "  !! sha256 校验不符 (期望 $napcatSha256, 实际 $got), 已丢弃下载的文件" $Yellow
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        }
    }
    if ($hashOk) {
        try {
            Say '  解压中 ...'
            Expand-Archive -Path $zipPath -DestinationPath $napcatDir -Force
            Say '  OK NapCat 已就位' $Green
        } catch {
            Say "  解压失败: $($_.Exception.Message)" $Yellow
        }
    }
    if (-not (Test-Path (Join-Path $napcatDir 'napcat.bat'))) {
        Say '  请手动下载 NapCat (约 110MB), 选 release 页里 NapCat.Shell.Windows.Node.zip:' $Yellow
        Say "  https://github.com/NapNeko/NapCatQQ/releases/tag/$napcatTag" $Yellow
        Say '  (建议核对该资产页面的 sha256 再用; 装其他版本请自行确认兼容)' $Yellow
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
        # A3: 重建前先备份原文件, 别把用户可能手工配过的东西直接冲掉
        Copy-Item $onebotPath "$onebotPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Force
        Say '  onebot11.json 读不出来, 已备份原文件并会重建一份' $Yellow
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
    # D10: 走 ConvertTo-Json, 不再手拼字符串模板 (转义/缩进都容易出错)
    $onebotObj = [ordered]@{
        network = [ordered]@{
            websocketServers = @(
                [ordered]@{
                    enable = $true
                    name = 'elysia-ws'
                    host = '127.0.0.1'
                    port = 3001
                    messagePostFormat = 'array'
                    reportSelfMessage = $false
                    token = $wsToken
                }
            )
        }
    }
    Write-NoBom $onebotPath ($onebotObj | ConvertTo-Json -Depth 10)
    Say '  OK OneBot 配置已写入 (端口 3001, 已带 token)' $Green
}

$launcher = Join-Path $napcatDir 'napcat\launcher.bat'
if (Test-Path $launcher) {
    # D9: 普通权限启动。QQ 协议端不需要管理员; 管理员跑 QQ 类程序纯属扩大攻击面。
    Start-Process cmd -ArgumentList "/c","cd /d $napcatDir\napcat && launcher.bat"
    Say '  已启动, 请用 QQ 小号扫码登录' $Yellow
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
