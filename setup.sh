#!/bin/bash
# Ruby Diamond Client — System Setup
# Run with: sudo bash setup.sh

echo "🔧 Installing system dependencies for Ruby Diamond..."

sudo dnf install -y \
  dbus-devel \
  gtk3-devel \
  librsvg2-devel \
  patchelf \
  webkit2gtk4.1-devel \
  libappindicator-gtk3-devel

echo ""
echo "✅ System dependencies installed."
echo ""
echo "Now run:"
echo "  cd ruby-diamond-client"
echo "  pnpm install"
echo "  pnpm tauri dev     # Development mode"
echo "  pnpm tauri build   # Production build (~7MB)"
