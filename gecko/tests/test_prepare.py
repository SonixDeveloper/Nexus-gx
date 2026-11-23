from pathlib import Path
import importlib.util
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("gecko_prepare", Path(__file__).resolve().parents[1] / "prepare.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrepareTests(unittest.TestCase):
    def make_source(self, root, version="153.7.0esr"):
        fixtures = {
            "mach": "",
            "browser/config/version_display.txt": version,
            "browser/branding/unofficial/configure.sh": "MOZ_APP_DISPLAYNAME=Nightly",
            "browser/branding/unofficial/content/jar.mn": "browser.jar:\n% content branding %content/branding/\n",
            "browser/branding/unofficial/locales/en-US/brand.ftl": "-brand-short-name = Nightly\n",
            "browser/branding/unofficial/pref/firefox-branding.js": "",
            "browser/branding/unofficial/default16.png": "original icon",
            "browser/base/content/browser.xhtml": "<html><head></head></html>",
            "browser/moz.configure": 'imply_option("MOZ_APP_VENDOR", "Mozilla")\n'
                                     'imply_option("MOZ_APP_ID", "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}")\n',
        }
        for filename, contents in fixtures.items():
            path = root / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(contents, encoding="utf-8")

    def test_adds_native_gecko_theme_and_separate_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            self.make_source(source)
            module.prepare(source)
            brand = source / "browser/branding/nexusgx"
            self.assertIn("NEXUS GX", (brand / "locales/en-US/brand.ftl").read_text())
            self.assertIn("Cyberpunk Neon", (brand / "content/nexus.js").read_text())
            self.assertIn("Midnight Sakura", (brand / "content/nexus.js").read_text())
            self.assertIn("nexus.js", (brand / "content/jar.mn").read_text())
            self.assertIn("chrome://branding/content/nexus.css", (source / "browser/base/content/browser.xhtml").read_text())
            self.assertIn(module.APP_ID, (source / "browser/moz.configure").read_text())
            self.assertEqual((brand / "default16.png").read_bytes(), (module.ROOT / "packaging/icon.png").read_bytes())

    def test_rejects_non_esr_checkout_before_modifying_files(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            self.make_source(source, "160.0.1")
            with self.assertRaisesRegex(ValueError, "Expected Firefox ESR"):
                module.prepare(source)
            self.assertFalse((source / "browser/branding/nexusgx").exists())


if __name__ == "__main__":
    unittest.main()
