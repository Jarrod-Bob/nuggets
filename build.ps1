# Build the frontend, then embed it in the Go binary.
Push-Location web
npm run build
if (-not $?) { Pop-Location; throw "frontend build failed" }
Pop-Location
go build -o nuggets.exe ./cmd/nuggets
if (-not $?) { throw "go build failed" }
Write-Host "built nuggets.exe"
