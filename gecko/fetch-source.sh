#!/usr/bin/env bash
set -euo pipefail

project="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
version="$(cat "$project/esr-version")"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+esr$ ]]
destination="${1:-"$project/work/source"}"
if [[ -e "$destination" || -L "$destination" ]]; then
  printf 'Choose a new source directory: %s\n' "$destination" >&2
  exit 1
fi

scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
base="https://archive.mozilla.org/pub/firefox/releases/$version"
archive="firefox-$version.source.tar.xz"
for path in KEY SHA512SUMS SHA512SUMS.asc "source/$archive"; do
  curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
    "$base/$path" -o "$scratch/${path##*/}"
done

# Mozilla rotated the release signing subkey in August 2026.
signer="827E658608679618CD349F93678E455D76767AA3"
primary="14F26682D0916CDD81E37B6D61B7B526D98F0353"
mkdir -m 700 "$scratch/keyring"
gpg --homedir "$scratch/keyring" --batch --import "$scratch/KEY"
gpg --homedir "$scratch/keyring" --batch --status-fd 1 --verify "$scratch/SHA512SUMS.asc" "$scratch/SHA512SUMS" > "$scratch/status"
awk -v signer="$signer" -v primary="$primary" \
  '$2 == "VALIDSIG" && $3 == signer && $NF == primary { ok=1 } END { exit !ok }' "$scratch/status"
awk -v file="source/$archive" -v name="$archive" \
  '$2 == file && $1 ~ /^[[:xdigit:]]+$/ && length($1) == 128 { print $1 "  " name; n++ } END { exit n != 1 }' \
  "$scratch/SHA512SUMS" > "$scratch/source.sha512"
(cd "$scratch" && sha512sum --check source.sha512)
mkdir -p "$(dirname -- "$destination")"
mkdir -- "$destination"
tar -xJf "$scratch/$archive" --strip-components=1 -C "$destination"
