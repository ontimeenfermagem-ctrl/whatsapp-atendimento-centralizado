# Gera os dois PDFs do ebook com o Edge (já vem no Windows), a partir de ebook.html.
#   powershell -ExecutionPolicy Bypass -File ebook\gerar-pdf.ps1
# Saída: ebook\saida\Plantao-de-Valor-celular.pdf e Plantao-de-Valor-A4.pdf
# Precisa de internet só para o QR code (biblioteca do cdnjs).
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$saida = Join-Path $aqui "saida"
New-Item -ItemType Directory -Force $saida | Out-Null
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$url = ([Uri](Join-Path $aqui "ebook.html")).AbsoluteUri
$perfil = Join-Path $env:TEMP "ebook-edge-perfil"

foreach ($f in @(@("celular", "Plantao-de-Valor-celular.pdf"), @("a4", "Plantao-de-Valor-A4.pdf"))) {
  $pdf = Join-Path $saida $f[1]
  Start-Process -Wait $edge -ArgumentList "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
    "--user-data-dir=$perfil", "--no-pdf-header-footer", "--virtual-time-budget=8000",
    "`"--print-to-pdf=$pdf`"", "$url`?f=$($f[0])"   # aspas: o caminho tem espaços ("Área de Trabalho")
  "{0}: {1:N0} KB" -f $f[1], ((Get-Item $pdf).Length / 1KB)
}
