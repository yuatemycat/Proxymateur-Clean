#!/bin/bash

APP_PATH="/Applications/Proxymateur.app"

echo "🛠️  修复 'Proxymateur' 已损坏问题..."

if [ -d "$APP_PATH" ]; then
    echo "📍 找到应用: $APP_PATH"
    echo "🔑 需要管理员权限来移除隔离属性 (Quarantine Attribute)..."
    
    sudo xattr -rd com.apple.quarantine "$APP_PATH"
    
    if [ $? -eq 0 ]; then
        echo "✅ 修复成功！现在应该可以正常打开应用了。"
    else
        echo "❌ 修复失败，请检查密码是否正确或是否有权限。"
    fi
else
    echo "⚠️  未找到应用，请确认应用已安装在 '/Applications' 目录下。"
    echo "   如果安装在其他位置，请手动运行: sudo xattr -rd com.apple.quarantine /path/to/app"
fi
