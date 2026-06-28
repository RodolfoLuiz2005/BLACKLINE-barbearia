$root = Resolve-Path '.'
$files = @(
  'frontend/index.html',
  'frontend/style.css',
  'frontend/script.js',
  'frontend/blackline-config.js',
  'frontend/firebase-data.js',
  'frontend/firebase-config.js'
)

$replacements = @(
  @{ From = 'Ã§'; To = 'ç' },
  @{ From = 'Ã£'; To = 'ã' },
  @{ From = 'Ã¡'; To = 'á' },
  @{ From = 'Ã©'; To = 'é' },
  @{ From = 'Ã­'; To = 'í' },
  @{ From = 'Ã³'; To = 'ó' },
  @{ From = 'Ãº'; To = 'ú' },
  @{ From = 'Ãª'; To = 'ê' },
  @{ From = 'Ã´'; To = 'ô' },
  @{ From = 'Ã¶'; To = 'ö' },
  @{ From = 'Ã¼'; To = 'ü' },
  @{ From = 'Ã '; To = 'à' },
  @{ From = 'Ã¨'; To = 'è' },
  @{ From = 'Ã¬'; To = 'ì' },
  @{ From = 'Ã²'; To = 'ò' },
  @{ From = 'Ã¹'; To = 'ù' },
  @{ From = 'Ã±'; To = 'ñ' },
  @{ From = 'Ã‡'; To = 'Ç' },
  @{ From = 'Ãƒ'; To = 'Ã' },
  @{ From = 'Ã‰'; To = 'É' },
  @{ From = 'Ã“'; To = 'Ó' },
  @{ From = 'Ãš'; To = 'Ú' },
  @{ From = 'Ã‘'; To = 'Á' },
  @{ From = 'ÃŒ'; To = 'Í' },
  @{ From = 'Ã€'; To = 'À' },
  @{ From = 'Ãˆ'; To = 'È' },
  @{ From = 'ÃŠ'; To = 'Ê' },
  @{ From = 'Ã‹'; To = 'Ë' },
  @{ From = 'ÃŽ'; To = 'Î' },
  @{ From = 'Ã'; To = 'Ï' },
  @{ From = 'Ã”'; To = 'Ô' },
  @{ From = 'Ã•'; To = 'Õ' },
  @{ From = 'Ã–'; To = 'Ö' },
  @{ From = 'Ã™'; To = 'Ù' },
  @{ From = 'Ã›'; To = 'Û' },
  @{ From = 'Ãœ'; To = 'Ü' },
  @{ From = 'ÃŸ'; To = 'ß' },
  @{ From = 'Â '; To = ' ' },
  @{ From = 'Â'; To = '' },
  @{ From = 'â€¢'; To = '•' },
  @{ From = 'â€™'; To = '’' },
  @{ From = 'â€“'; To = '–' },
  @{ From = 'â€œ'; To = '“' },
  @{ From = 'â€'; To = '”' },
  @{ From = 'â€¦'; To = '…' },
  @{ From = '�'; To = '' },
  @{ From = 'â€'; To = '“' }
)

foreach ($relativePath in $files) {
  $fullPath = Join-Path $root $relativePath
  if (-not (Test-Path $fullPath)) { continue }
  $text = [IO.File]::ReadAllText($fullPath, [Text.UTF8Encoding]::new($false))
  foreach ($entry in $replacements) {
    $text = $text.Replace($entry.From, $entry.To)
  }
  [IO.File]::WriteAllText($fullPath, $text, [Text.UTF8Encoding]::new($false))
  Write-Host "Fixed $relativePath"
}
