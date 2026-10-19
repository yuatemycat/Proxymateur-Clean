if (Test-Path "E:\03_Devops\env.ps1") {
    . E:\03_Devops\env.ps1
}
npm run tauri dev -- --release
