$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$dir = "c:/AppServ/www/hr-mobile-connect/public/models"

$files = @(
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

foreach ($f in $files) {
    Write-Host "Downloading $f..."
    Invoke-WebRequest -Uri "$base/$f" -OutFile "$dir/$f"
    Write-Host "  Done ($((Get-Item "$dir/$f").Length) bytes)"
}

Write-Host "`nAll models downloaded!"
Get-ChildItem $dir | Format-Table Name, Length
