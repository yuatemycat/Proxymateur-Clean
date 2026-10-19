cask "proxymateur" do
  version "4.9.5"
  sha256 :no_check

  name "Proxymateur"
  desc "Professional Account Management for AI Services"
  homepage "https://github.com/52191314/Antigravity-Manager"

  on_macos do
    arch intel: "x64", arm: "aarch64"

    url "https://github.com/52191314/Antigravity-Manager/releases/download/v#{version}/Proxymateur_#{version}_#{arch}.dmg"

    app "Proxymateur.app"

    postflight_steps do
      run "/usr/bin/xattr",
          args:         ["-rd", "com.apple.quarantine", "{{appdir}}/Proxymateur.app"],
          must_succeed: false
    end

    zap trash: [
      "~/Library/Application Support/com.proxymateur.app",
      "~/Library/Caches/com.proxymateur.app",
      "~/Library/Preferences/com.proxymateur.app.plist",
      "~/Library/Saved Application State/com.proxymateur.app.savedState",
    ]
  end

  on_linux do
    arch arm: "aarch64", intel: "amd64"

    url "https://github.com/52191314/Antigravity-Manager/releases/download/v#{version}/Proxymateur_#{version}_#{arch}.AppImage"
    binary "Proxymateur_#{version}_#{arch}.AppImage", target: "proxymateur"

    preflight_steps do
      set_permissions "Proxymateur_{{version}}_{{arch}}.AppImage", "0755"
    end
  end
end
