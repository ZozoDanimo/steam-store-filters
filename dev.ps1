# Build the plugin
npx millennium-ttc --build dev
if ($LASTEXITCODE -eq 0) {
    Write-Host "Build OK - press Ctrl+R in Steam to reload" -ForegroundColor Green
} else {
    Write-Host "Build FAILED" -ForegroundColor Red
}
