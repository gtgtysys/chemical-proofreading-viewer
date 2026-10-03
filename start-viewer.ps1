param(
  [int]$Port = 4173,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'dist'))
if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'index.html'))) {
  throw "dist/index.html が見つかりません。"
}

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.bcmap'= 'application/octet-stream'
  '.wasm' = 'application/wasm'
  '.ttf'  = 'font/ttf'
  '.pfb'  = 'application/octet-stream'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
$url = "http://127.0.0.1:$Port/"
Write-Host "化学PDF校正ビューアを起動しました: $url"
Write-Host '終了するには、この画面で Ctrl+C を押してください。'
if (-not $NoBrowser) { Start-Process $url }

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if (-not $requestLine) { continue }
      while ($reader.ReadLine()) { }

      $parts = $requestLine.Split(' ')
      $method = $parts[0]
      $requestPath = if ($parts.Length -ge 2) { $parts[1].Split('?')[0] } else { '/' }
      $decoded = [System.Uri]::UnescapeDataString($requestPath).TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      if (-not $decoded) { $decoded = 'index.html' }
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $siteRoot $decoded))

      $isSafe = $filePath.StartsWith($siteRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or $filePath -eq (Join-Path $siteRoot 'index.html')
      if (-not $isSafe -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $status = '404 Not Found'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $contentType = 'text/plain; charset=utf-8'
      } elseif ($method -notin @('GET', 'HEAD')) {
        $status = '405 Method Not Allowed'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        $contentType = 'text/plain; charset=utf-8'
      } else {
        $status = '200 OK'
        $body = [System.IO.File]::ReadAllBytes($filePath)
        $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
      }

      $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($method -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
    } catch {
      Write-Warning $_.Exception.Message
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
