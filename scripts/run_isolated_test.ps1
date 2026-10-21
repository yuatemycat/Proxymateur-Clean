param(
    [string]$Filter = "proxy::openai_upstream::tests"
)

$targetDir = "E:\02_Projects\Proxymateur-Clean\src-tauri\target\release\deps"
$testExe = Get-ChildItem -Path $targetDir -Filter "proxymateur_lib-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $testExe) {
    Write-Error "No test executable found in $targetDir"
    exit 1
}

$isolatedDir = "E:\02_Projects\Proxymateur-Clean\src-tauri\target\test_isolated"
if (-not (Test-Path $isolatedDir)) {
    New-Item -ItemType Directory -Path $isolatedDir -Force | Out-Null
}

$destExe = Join-Path $isolatedDir "test_runner.exe"
Copy-Item -Force $testExe.FullName $destExe

$manifestPath = "$destExe.manifest"
$manifestContent = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
</assembly>
"@

[System.IO.File]::WriteAllText($manifestPath, $manifestContent)

$loaderSource = "E:\02_Projects\Proxymateur-Clean\src-tauri\target\release\WebView2Loader.dll"
if (Test-Path $loaderSource) {
    Copy-Item -Force $loaderSource (Join-Path $isolatedDir "WebView2Loader.dll")
}

Write-Host "[*] Executing isolated test runner with filter: $Filter"
& $destExe $Filter --test-threads=1 --nocapture
exit $LASTEXITCODE
