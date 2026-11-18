# Fallback local static server (no Python/Node needed): PowerShell + System.Net.HttpListener.
# Binds to 127.0.0.1 only. Usage: powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8765] [-NoOpen]
param([int]$Port = 8765, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css';
  '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml';
  '.woff2'='font/woff2'; '.wasm'='application/wasm'; '.ico'='image/x-icon'; '.txt'='text/plain'; '.md'='text/plain'
}
# if the port is busy (another copy already running), try the next ones instead of failing silently
$listener = $null
for ($p = $Port; $p -lt $Port + 10; $p++) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://127.0.0.1:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
}
if (-not $listener) { throw "Could not open a local port between $Port and $($Port + 9)." }
$prefix = "http://127.0.0.1:$Port/"
Write-Host "Serving $root at $prefix  (close this window to stop)"
if (-not $NoOpen) { Start-Process $prefix }
$rootFull = [System.IO.Path]::GetFullPath($root)
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($rel -eq '') { $rel = 'index.html' }
      $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
      # prevent path traversal outside the project folder
      if (-not $path.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404; $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      } else {
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $bytes = [System.IO.File]::ReadAllBytes($path)
      }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch { $res.StatusCode = 500 } finally { $res.OutputStream.Close() }
  }
} finally { $listener.Stop() }
