#!/usr/bin/env python3
"""Apply the NEXUS GX desktop overlay to a fresh Firefox ESR source tree."""
import argparse
import json
from pathlib import Path
import re
import shutil

GECKO = Path(__file__).resolve().parent
ROOT = GECKO.parent
APP_ID = "{be8dbc41-5a0c-4556-8209-e0e315e6a89a}"


def replace_once(file, search, replacement):
    contents = file.read_text(encoding="utf-8")
    if contents.count(search) != 1:
        raise ValueError(f"{file}: expected exactly one match for {search!r}")
    file.write_text(contents.replace(search, replacement), encoding="utf-8")


def palettes():
    model = (ROOT / "src/shared/model.ts").read_text(encoding="utf-8")
    block = model.split("export const presets = [", 1)[1].split("] as const", 1)[0]
    found = re.findall(r"\['([^'\r\n]+)', '(#[a-fA-F0-9]{6})', '(#[a-fA-F0-9]{6})'\]", block)
    if len(found) != 20 or len({name for name, _, _ in found}) != len(found):
        raise ValueError("Could not identify the 20 distinct NEXUS palettes")
    return found


def brand(source):
    branding = source / "browser/branding"
    target = branding / "nexusgx"
    shutil.copytree(branding / "unofficial", target)
    (target / "configure.sh").write_text(
        "MOZ_APP_DISPLAYNAME='NEXUS GX'\nMOZ_MACBUNDLE_ID=nexusgx\n", encoding="utf-8"
    )
    for file in (target / "locales").rglob("brand.ftl"):
        text = file.read_text(encoding="utf-8")
        text = re.sub(r"(?m)^(-brand-[\w-]+|-vendor-short-name) = .*", r"\1 = NEXUS GX", text)
        file.write_text(text, encoding="utf-8")
    for file in (target / "locales").rglob("brand.properties"):
        text = file.read_text(encoding="utf-8")
        text = re.sub(r"(?m)^((?:brand\w+|vendorShortName)=).*", r"\1NEXUS GX", text)
        file.write_text(text, encoding="utf-8")
    for file in target.iterdir():
        if re.fullmatch(r"default\d+\.png|(?:PrivateBrowsing|VisualElements)_\d+\.png", file.name):
            shutil.copyfile(ROOT / "packaging/icon.png", file)
        elif file.name in {"firefox.ico", "document.ico", "document_pdf.ico", "lockup.ico", "privatebrowsing.ico", "private-browsing.ico"}:
            shutil.copyfile(ROOT / "packaging/icon.ico", file)
    for name in ("about.png", "about-logo.png", "about-logo@2x.png", "about-logo-private.png", "about-logo-private@2x.png"):
        file = target / "content" / name
        if file.exists():
            shutil.copyfile(ROOT / "packaging/icon.png", file)
    import base64
    icon = base64.b64encode((ROOT / "packaging/icon.png").read_bytes()).decode("ascii")
    for name in ("about-logo.svg", "about-wordmark.svg", "firefox-wordmark.svg"):
        file = target / "content" / name
        if file.exists():
            file.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,{icon}"/></svg>\n', encoding="utf-8")
    return target


def prepare(source):
    esr = (GECKO / "esr-version").read_text(encoding="utf-8").strip()
    version = (source / "browser/config/version_display.txt").read_text(encoding="utf-8").strip()
    if version != esr or not (source / "mach").is_file():
        raise ValueError(f"Expected Firefox ESR {esr}, got {version!r}")
    target = brand(source)
    content = target / "content"
    shutil.copyfile(GECKO / "chrome/nexus.css", content / "nexus.css")
    script = (GECKO / "chrome/nexus.js").read_text(encoding="utf-8")
    (content / "nexus.js").write_text(f"const NEXUS_PALETTES = {json.dumps(palettes())};\n{script}", encoding="utf-8")
    with (content / "jar.mn").open("a", encoding="utf-8") as manifest:
        manifest.write("\n  content/branding/nexus.css\n  content/branding/nexus.js\n")
    replace_once(
        source / "browser/base/content/browser.xhtml",
        "</head>",
        '  <link rel="stylesheet" href="chrome://branding/content/nexus.css" />\n'
        '  <script src="chrome://branding/content/nexus.js"></script>\n</head>',
    )
    config = source / "browser/moz.configure"
    replace_once(config, '"{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"', f'"{APP_ID}"')
    replace_once(config, 'imply_option("MOZ_APP_VENDOR", "Mozilla")', 'imply_option("MOZ_APP_VENDOR", "NEXUS GX")')
    with (target / "pref/firefox-branding.js").open("a", encoding="utf-8") as prefs:
        prefs.write(
            '\npref("toolkit.telemetry.enabled", false);\n'
            'pref("datareporting.healthreport.uploadEnabled", false);\n'
            'pref("app.normandy.enabled", false);\n'
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    options = parser.parse_args()
    try:
        prepare(options.source.resolve())
    except (OSError, ValueError) as error:
        parser.exit(1, f"NEXUS GX Gecko: {error}\n")
