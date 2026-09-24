# -*- coding: utf-8 -*-
# ============================================================
#  DeepSeek Harness 全自动一键安装 v3 (小白版)
#  双击 install.bat -> 全自动: 自检环境 -> 缺啥装啥 -> 装 DSH
#  -> 失败自动换源重试 -> 粘 Key -> 自动启动
#  小白只需要: 等 + 粘贴 Key
#
#  v3 修复: 不用 ErrorActionPreference=Stop (PS5.1 下外部命令
#  stderr 会触发 NativeCommandError 误报), 全部外部命令用
#  cmd /c "... >nul 2>&1" 包裹, 用退出码判断真实成败。
# ============================================================
$Cyan = 'Cyan'; $Green = 'Green'; $Yellow = 'Yellow'; $Pink = 'Magenta'
function Say($m, $c = $Cyan) { Write-Host "  $m" -ForegroundColor $c }

Say '======================================================' $Pink
Say '   DeepSeek Harness 全自动安装' $Pink
Say '   你只需要做两件事:' $Pink
Say '   1. 等它自动装完   2. 粘贴秘钥' $Pink
Say '======================================================' $Pink
Say ''

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}

# ---------- [1/5] Node.js + npm 自动检查/修复 ----------
Say '[1/5] 检查运行环境 ...'
Refresh-Path
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($node -and $npm) {
    $nv = cmd /c "node --version 2>nul"
    $pv = cmd /c "npm --version 2>nul"
    Say "  OK 已就绪: node $nv / npm $pv" $Green
} else {
    Say '  未检测到完整 Node.js (或 npm 缺失), 开始自动安装...' $Yellow
    Say '  约 1-3 分钟, 请耐心等待, 不要关闭窗口~' $Yellow
    $ok = $false
    # 方案1: winget
    Say '  尝试 winget 安装...' $Yellow
    cmd /c "winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent >nul 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Refresh-Path
        $node = Get-Command node -ErrorAction SilentlyContinue
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        if ($node -and $npm) { $ok = $true }
    }
    # 方案2: 国内镜像下载官方安装包
    if (-not $ok) {
        try {
            Say '  改用国内镜像下载 Node.js 安装包...' $Yellow
            $idx = Invoke-RestMethod 'https://npmmirror.com/mirrors/node/index.json' -TimeoutSec 30
            $ver = ($idx | Where-Object { $_.version -like 'v24*' } | Select-Object -First 1).version
            if (-not $ver) { $ver = ($idx | Select-Object -First 1).version }
            $url = "https://npmmirror.com/mirrors/node/$ver/node-$ver-x64.msi"
            Say "  下载 $url ..." $Yellow
            $installer = Join-Path $env:TEMP 'nodejs-setup.msi'
            Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing -TimeoutSec 180
            if ((Get-Item $installer).Length -gt 5MB) {
                Say '  静默安装中...' $Yellow
                Start-Process msiexec -ArgumentList "/i `"$installer`" /qn /norestart" -Wait
                Refresh-Path
                $node = Get-Command node -ErrorAction SilentlyContinue
                $npm = Get-Command npm -ErrorAction SilentlyContinue
                if ($node -and $npm) { $ok = $true }
            }
        } catch {
            Say "  镜像下载失败: $($_.Exception.Message)" $Yellow
        }
    }
    if (-not $ok) {
        Say '  !!! 自动安装没成功, 需要你手动帮一下:' $Yellow
        Say '  1. 打开 https://nodejs.org 下载 LTS 版' $Yellow
        Say '  2. 双击安装, 一路点下一步' $Yellow
        Say '  3. 装完重新双击本文件就行啦' $Yellow
        Read-Host '按回车退出'; exit 1
    }
    $nv = cmd /c "node --version 2>nul"
    $pv = cmd /c "npm --version 2>nul"
    Say "  OK 已就绪: node $nv / npm $pv" $Green
}

# ---------- [2/5] 安装 DSH (自动换源重试) ----------
Say '[2/5] 安装 DeepSeek Harness ...'
$registry = ''
$installed = $false
# 版本必须钉死: npm 的 latest 标签指向的是 0.1.5-rc.3 (不是最新),
# 不写版本号会装成旧版 —— 而本包的插件/预设是按 0.1.6 写的, 装错版本跑不通
$dshVer = '0.1.6-alpha.2'
for ($try = 1; $try -le 3; $try++) {
    Say "  第 $try 次尝试..." $Yellow
    if ($registry) {
        cmd /c "npm install -g @deepseek-ai/dsh@${dshVer} --registry=$registry >nul 2>&1"
    } else {
        cmd /c "npm install -g @deepseek-ai/dsh@${dshVer} >nul 2>&1"
    }
    if ($LASTEXITCODE -eq 0) { $installed = $true; break }
    if ($try -eq 1) {
        Say '  官方源较慢/失败, 自动切换国内镜像源...' $Yellow
        $registry = 'https://registry.npmmirror.com'
    }
}
if (-not $installed) {
    Say '  !!! 安装失败, 请检查网络后重新双击本文件' $Yellow
    Read-Host '按回车退出'; exit 1
}
Refresh-Path
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($dsh) { Say "  OK 安装完成: $(cmd /c "dsh --version 2>nul")" $Green }
else { Say '  OK 安装完成' $Green }

# dsh 的插件管理 (`dsh plugin add`) 内部是转发给 pnpm 的, 找不到 pnpm 会直接
# 以 exit 127 失败。顺手装上; 失败只警告不阻塞 —— 不装 QQ 包的话用不到它。
Say '  检查 pnpm (插件管理需要) ...'
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Say '  OK pnpm 已存在' $Green
} else {
    cmd /c "npm install -g pnpm >nul 2>&1"
    Refresh-Path
    if (Get-Command pnpm -ErrorAction SilentlyContinue) { Say '  OK pnpm 已安装' $Green }
    else { Say '  未装上 pnpm (不影响纯聊天, 但装 QQ 包会需要它)' $Yellow }
}

# ---------- [3/5] API Key ----------
Say '[3/5] 配置 API Key ...'
$key = (Read-Host '  请粘贴 DeepSeek API Key (https://platform.deepseek.com 免费获取)').Trim()
if ($key.Length -lt 10) { Say '  Key 无效'; Read-Host '回车退出'; exit 1 }
$dshHome = Join-Path $env:USERPROFILE '.dsh'
New-Item -ItemType Directory -Path $dshHome -Force | Out-Null
@"
version: 1
refs:
  DEEPSEEK_API_KEY: '$key'
"@ | Set-Content -Path (Join-Path $dshHome '.credentials.yaml') -Encoding UTF8
$settingsPath = Join-Path $dshHome 'settings.yaml'
if (-not (Test-Path $settingsPath)) {
    @"
agent-default-model:
  model: deepseek-v4-flash
  provider: deepseek-official
"@ | Set-Content -Path $settingsPath -Encoding UTF8
}
Say '  OK Key 已配置' $Green

# ---------- [4/5] 启动 (后台 + 开机自启 + 桌面启动器) ----------
Say '[4/5] 启动 DeepSeek Harness ...'
# 后台隐藏启动 dsh web (不依赖窗口, 关窗也不影响)
Start-Process powershell -ArgumentList '-NoProfile','-WindowStyle','Hidden','-Command','dsh web' -WindowStyle Hidden
# 桌面启动器 (小白以后手动启动用)
$launcherPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'start-elysia.bat'
@'
@echo off
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "dsh web"
timeout /t 5 /nobreak >nul
start http://127.0.0.1:3080
'@ | Set-Content -Path $launcherPath -Encoding ASCII
# 开机自启 (复制到 Startup 文件夹)
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
try {
    Copy-Item $launcherPath (Join-Path $startupDir 'start-elysia.bat') -Force
    Say '  已设置: 开机自动后台启动' $Green
} catch {
    Say '  (开机自启设置失败, 不影响使用)' $Yellow
}
Start-Sleep -Seconds 6
Say ''
Say '  ========================================' $Pink
Say '   全部搞定!!!' $Green
Say '   浏览器已打开 http://127.0.0.1:3080' $Green
Say '   (如果没自动打开, 手动输入这个地址即可)' $Green
Say '   以后电脑重启后:' $Green
Say '   直接开浏览器访问 http://127.0.0.1:3080' $Green
Say '   或双击桌面的 start-elysia.bat' $Green
Say '   (dsh 在后台运行, 不要关闭任何黑色窗口)' $Green
Say '  ========================================' $Pink
Say ''
Read-Host '按回车关闭窗口'
