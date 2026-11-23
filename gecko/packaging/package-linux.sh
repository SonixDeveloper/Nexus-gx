#!/usr/bin/env bash
set -euo pipefail

layout="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd -- "$layout/../.." && pwd)"
app_id=com.sonixdeveloper.nexusgx
archive="$(realpath "${1:?Usage: package-linux.sh ARCHIVE OUTPUT deb|appimage|flatpak}")"
output="$(realpath -m "${2:?Output directory required}")"
target="${3:?Package format required}"
case "$target" in deb|appimage|flatpak) ;; *) printf 'Unknown target: %s\n' "$target" >&2; exit 2 ;; esac
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$scratch/source" "$output"
tar -xf "$archive" --no-same-owner --no-same-permissions -C "$scratch/source"
mapfile -t binaries < <(find "$scratch/source" -type f -name nexus-gx)
if [[ "${#binaries[@]}" -ne 1 ]]; then
  printf 'Expected one native NEXUS GX browser executable\n' >&2
  exit 1
fi
binary="${binaries[0]}"
browser="$(dirname -- "$binary")"
test -x "$binary"
test -s "$browser/libxul.so"
test -s "$browser/application.ini"
grep -Fxq 'Name=NexusGX' "$browser/application.ini"
LC_ALL=C file "$binary" | grep -Eq 'ELF 64-bit.*x86-64'
version="$(sed -n 's/^Version=\([0-9][0-9.]*\)$/\1/p' "$browser/application.ini" | head -n 1)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]

case "$target" in
  deb)
    stage="$scratch/deb"
    install -d "$stage/DEBIAN" "$stage/usr/lib/nexus-gx" "$stage/usr/bin"
    cp -a "$browser/." "$stage/usr/lib/nexus-gx/"
    ln -s ../lib/nexus-gx/nexus-gx "$stage/usr/bin/nexus-gx"
    install -Dm644 "$layout/$app_id.desktop" "$stage/usr/share/applications/$app_id.desktop"
    install -Dm644 "$repo/packaging/icon.png" "$stage/usr/share/icons/hicolor/256x256/apps/$app_id.png"
    install -Dm644 "$layout/$app_id.metainfo.xml" "$stage/usr/share/metainfo/$app_id.metainfo.xml"
    cat > "$stage/DEBIAN/control" <<CONTROL
Package: nexus-gx-gecko
Version: ${version}~esr-1
Section: web
Priority: optional
Architecture: amd64
Maintainer: NEXUS GX <SonixDeveloper@users.noreply.github.com>
Depends: libgtk-3-0t64 | libgtk-3-0, libasound2t64 | libasound2, libdbus-glib-1-2, libx11-xcb1, libxt6t64 | libxt6, libglib2.0-0t64 | libglib2.0-0, libstdc++6
Description: NEXUS GX browser on Firefox ESR
 Custom NEXUS GX appearance and native Gecko rendering.
CONTROL
    dpkg-deb --root-owner-group --build "$stage" "$output/nexus-gx-gecko_amd64.deb"
    dpkg-deb --info "$output/nexus-gx-gecko_amd64.deb"
    ;;
  appimage)
    tool="$(realpath "${APPIMAGETOOL:?Set APPIMAGETOOL to the verified AppImage tool path}")"
    runtime="$(realpath "${APPIMAGE_RUNTIME:?Set APPIMAGE_RUNTIME to the verified Type 2 runtime path}")"
    stage="$scratch/NexusGX.AppDir"
    install -d "$stage/usr/lib/nexus-gx"
    cp -a "$browser/." "$stage/usr/lib/nexus-gx/"
    install -m644 "$layout/$app_id.desktop" "$stage/$app_id.desktop"
    install -m644 "$repo/packaging/icon.png" "$stage/$app_id.png"
    cat > "$stage/AppRun" <<'LAUNCHER'
#!/bin/sh
set -eu
root="$(dirname -- "$(readlink -f -- "$0")")"
exec "$root/usr/lib/nexus-gx/nexus-gx" "$@"
LAUNCHER
    chmod 0755 "$stage/AppRun"
    ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$tool" --runtime-file "$runtime" "$stage" "$output/NEXUS-GX-Gecko-x86_64.AppImage"
    "$output/NEXUS-GX-Gecko-x86_64.AppImage" --appimage-extract-and-run --version
    ;;
  flatpak)
    stage="$scratch/flatpak"
    install -d "$stage/browser"
    cp -a "$browser/." "$stage/browser/"
    install -m644 "$layout/$app_id.desktop" "$layout/$app_id.yml" "$layout/$app_id.metainfo.xml" "$stage/"
    install -m644 "$repo/packaging/icon.png" "$stage/icon.png"
    printf '#!/bin/sh\nexec /app/lib/nexus-gx/nexus-gx "$@"\n' > "$stage/launcher"
    (
      cd "$stage"
      flatpak-builder --user --force-clean --repo=repo build "$app_id.yml"
      flatpak build-bundle repo "$output/NEXUS-GX-Gecko.flatpak" "$app_id" master
    )
    ;;
esac
