# -*- coding: utf-8 -*-
# 包5：独立安装长期记忆 bundle，不修改人格 preset，不安装运行时依赖。
$ErrorActionPreference = 'Stop'
$Cyan = 'Cyan'; $Green = 'Green'; $Yellow = 'Yellow'
function Say($m, $c = $Cyan) { Write-Host "  $m" -ForegroundColor $c }

Say '包5 · 长期记忆安装'
# 与包3 保持同一个安装根；插件是独立的 profile bundle。
$base = 'D:\AI\JARVIS'
$scriptDir = ($args[0] -replace '"', '').TrimEnd('\')
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }

try {
    if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
        Say '未检测到 dsh，请先安装包1。记忆插件没装上，其余功能不受影响。' $Yellow
        Read-Host '按回车关闭'
        exit 0
    }

    # 先检查 profile，再复制文件；已有 GitHub 或本地来源都跳过，不覆盖用户原安装。
    $profileManifest = Join-Path $dshHome 'profiles\web\package.json'
    if (Test-Path -LiteralPath $profileManifest) {
        $profile = Get-Content -LiteralPath $profileManifest -Raw | ConvertFrom-Json
        if ($profile.dependencies -and $profile.dependencies.PSObject.Properties.Name -contains 'dsh-memory') {
            Say '已装过，跳过' $Green
            Read-Host '按回车关闭'
            exit 0
        }
    }

    $pluginDir = Join-Path $base 'dsh-memory'
    $payload = Join-Path $scriptDir 'mods\memory'
    if (-not (Test-Path -LiteralPath (Join-Path $payload 'package.json'))) {
        throw '安装包缺少 mods/memory/package.json'
    }
    New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null
    Copy-Item (Join-Path $payload '*') $pluginDir -Recurse -Force
    # dsh-memory 零运行时依赖，不运行 npm install。
    $pluginDirSlash = $pluginDir.Replace('\', '/')
    cmd /c "dsh plugin --profile web add `"$pluginDirSlash`" 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Say '记忆插件没装上，其余功能不受影响。请检查上方错误后重试。' $Yellow
    } else {
        Say '记忆插件已进 web profile。请重启 dsh web。' $Green
        Say '可在私聊中请求记录一条事实，或手动调用 memory_organize。'
        Say '自动整理需要 schedule 服务；本包钉住版本的 web profile 没有该服务。' $Yellow
    }
} catch {
    Say "记忆插件没装上，其余功能不受影响。$($_.Exception.Message)" $Yellow
}
Read-Host '按回车关闭'
exit 0
