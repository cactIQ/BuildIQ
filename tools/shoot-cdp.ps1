# Headless-Chrome screenshot tool (no Python/Node needed). Uses the real GPU (d3d11).
# The local server must be running first:  powershell -File tools\serve.ps1 -NoOpen
# Usage:  .\tools\shoot-cdp.ps1 -Views hero,pool -Out C:\temp\shots -Query tod=1
#   -Query  e.g. tod=0..1 (0 day, 0.35 golden, 0.65 dusk, 1 night) or q=high|low
#   -Url <full url> -Pre "<js promise run before the shot>" -Eval "<js; its JSON result is printed>" -W 1600 -H 900 -Timeout 180
# Waits for window.__ready, saves <view>.png, prints console errors and a short app.report().
# Minimal CDP shooter: headless Chrome (real GPU via d3d11), waits for window.__ready, screenshots each view.
param([string]$Views = 'hero,elevation,aerial,aerialN,pool,clubhouse,gym', [string]$Out, [string]$Query = '', [int]$W = 1600, [int]$H = 900, [int]$Timeout = 180, [string]$Eval = '', [string]$Url = '', [string]$Pre = '', [switch]$Mobile, [string]$Clip = '')
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Out | Out-Null
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$port = 9333
$prof = Join-Path $env:TEMP ('cdpprof' + [guid]::NewGuid().ToString('N'))
$p = Start-Process $chrome -PassThru -ArgumentList @("--headless=new", "--remote-debugging-port=$port", "--user-data-dir=$prof", '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', "--window-size=$W,$H", '--hide-scrollbars', 'about:blank')
for ($w = 0; $w -lt 40; $w++) { try { Invoke-RestMethod "http://127.0.0.1:$port/json/version" | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }
$script:id = 0
function Send-Cdp($ws, $method, $params) {
  $script:id++; $myId = $script:id
  $msg = @{ id = $myId; method = $method; params = $(if ($params) { $params } else { @{} }) } | ConvertTo-Json -Depth 10 -Compress
  $b = [Text.Encoding]::UTF8.GetBytes($msg)
  $ws.SendAsync([ArraySegment[byte]]$b, 'Text', $true, [Threading.CancellationToken]::None).Wait()
  while ($true) {
    $r = Receive-Cdp $ws
    if ($r.id -eq $myId) { return $r }
  }
}
$script:logs = New-Object System.Collections.ArrayList
function Receive-Cdp($ws) {
  $buf = New-Object byte[] 1048576; $ms = New-Object IO.MemoryStream
  do { $res = $ws.ReceiveAsync([ArraySegment[byte]]$buf, [Threading.CancellationToken]::None).Result; $ms.Write($buf, 0, $res.Count) } while (-not $res.EndOfMessage)
  $o = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
  if ($o.method -eq 'Runtime.exceptionThrown') { [void]$script:logs.Add('EXC: ' + $o.params.exceptionDetails.exception.description) }
  if ($o.method -eq 'Runtime.consoleAPICalled' -and ($o.params.type -eq 'error' -or $o.params.type -eq 'warning')) { [void]$script:logs.Add($o.params.type + ': ' + (($o.params.args | ForEach-Object { $_.value }) -join ' ')) }
  return $o
}
try {
  foreach ($v in $Views.Split(',')) {
    $script:logs.Clear()
    $t = Invoke-RestMethod -Method Put "http://127.0.0.1:$port/json/new?about:blank"
    $ws = New-Object Net.WebSockets.ClientWebSocket
    $ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(0)
    $ws.ConnectAsync([Uri]$t.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
    [void](Send-Cdp $ws 'Runtime.enable' $null)
    [void](Send-Cdp $ws 'Page.enable' $null)
    [void](Send-Cdp $ws 'Emulation.setDeviceMetricsOverride' @{ width = $W; height = $H; deviceScaleFactor = $(if ($Mobile) { 2 } else { 1 }); mobile = [bool]$Mobile })
    if ($Mobile) { [void](Send-Cdp $ws 'Emulation.setTouchEmulationEnabled' @{ enabled = $true; maxTouchPoints = 5 }); [void](Send-Cdp $ws 'Emulation.setUserAgentOverride' @{ userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' }) }
    $url = if ($Url) { $Url } else { "http://127.0.0.1:8765/?view=$v&q=high&shot=1" + $(if ($Query) { "&$Query" } else { '' }) }
    $t0 = Get-Date
    [void](Send-Cdp $ws 'Page.navigate' @{ url = $url })
    $ok = $false
    while (((Get-Date) - $t0).TotalSeconds -lt $Timeout) {
      Start-Sleep -Milliseconds 700
      $r = Send-Cdp $ws 'Runtime.evaluate' @{ expression = 'window.__ready === true'; returnByValue = $true }
      if ($r.result.result.value -eq $true) { $ok = $true; break }
    }
    if ($Pre) { [void](Send-Cdp $ws 'Runtime.evaluate' @{ expression = $Pre; awaitPromise = $true; returnByValue = $true }); Start-Sleep 3 }
    Start-Sleep -Milliseconds 600
    $name = $v + $(if ($Query) { '.' + ($Query -replace '[^a-zA-Z0-9]+', '_') } else { '' })
    $shotP = @{ format = 'png' }
    if ($Clip) { $cw, $ch = $Clip.Split('x'); $shotP.clip = @{ x = 0; y = 0; width = [int]$cw; height = [int]$ch; scale = 2 } }
    $r = Send-Cdp $ws 'Page.captureScreenshot' $shotP
    [IO.File]::WriteAllBytes((Join-Path $Out "$name.png"), [Convert]::FromBase64String($r.result.data))
    $rep = Send-Cdp $ws 'Runtime.evaluate' @{ expression = 'JSON.stringify(window.app ? window.app.report() : window.__report)'; returnByValue = $true }
    $secs = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
    "[$(if ($ok) {'ok'} else {'TIMEOUT'})] $name ${secs}s  logs=$($script:logs.Count)"
    $script:logs | Select-Object -First 8 | ForEach-Object { "    $_" }
    if ($Eval) { $ev = Send-Cdp $ws 'Runtime.evaluate' @{ expression = $Eval; returnByValue = $true }; "    eval: " + ($ev.result.result.value | ConvertTo-Json -Compress -Depth 5) }
    $rj = $rep.result.result.value
    if ($rj) { "    report: " + $rj.Substring(0, [math]::Min(300, $rj.Length)) }
    $ws.Dispose()
    try { Invoke-RestMethod "http://127.0.0.1:$port/json/close/$($t.id)" | Out-Null } catch {}
  }
} finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$prof*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
