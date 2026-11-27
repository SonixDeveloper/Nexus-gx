# Instalacja i wydania

## Wymagania

Windows 11 x64 z bieżącymi aktualizacjami. Windows 10 nie jest objęty wsparciem projektu. Standardowy cykl aktualizacji Windows 10 22H2 zakończył się, a kanały ESU i LTSC mają oddzielne cykle. Zgodność konkretnej edycji z NEXUS GX wymaga testu.

Linux x86_64 z obsługą sandboxa Chromium oraz sesją X11 albo Wayland. Formaty i dystrybucje docelowe wymagają walidacji na rzeczywistych instalacjach. Nie dodawaj flagi `--no-sandbox`. Jeśli AppImage nie startuje ze względu na politykę przestrzeni nazw użytkownika, użyj zweryfikowanego pakietu Flatpak lub DEB, kiedy będą dostępne.

## Instalacja zweryfikowanego artefaktu

- Windows 11 — uruchom podpisany `NEXUS-GX-Setup.exe`, wybierz katalog instalacji, a następnie wybierz NEXUS GX w ustawieniach aplikacji domyślnych. Odinstaluj z listy aplikacji.
- Ubuntu, Debian, Mint — `sudo apt install ./nexus-gx_amd64.deb`. Odinstalowanie przez `sudo apt remove nexus-gx`.
- Linux Flatpak — `flatpak install --user ./NEXUS-GX.flatpak`. Uruchomienie przez `flatpak run io.github.nexusgx.NexusGX`. Odinstalowanie przez `flatpak uninstall --user io.github.nexusgx.NexusGX`.
- Linux AppImage — nadaj uprawnienie wykonywania przez `chmod +x NEXUS-GX-x86_64.AppImage`, a następnie uruchom plik. Konfiguracja wybiera statyczny runtime AppImage 1.0.3. Jeśli launcher spróbuje uruchomić Chromium bez sandboxa, aplikacja kończy pracę. AppImage można zintegrować z menu samodzielnie. Flatpak i AppImage są docelowymi formatami dla Fedora i Arch.

## Budowa Flatpak

Na Linuksie zainstaluj `flatpak`, `flatpak-builder`, runtime Freedesktop i bazę Electron. W katalogu głównym uruchom:

```sh
npm run dist:linux
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08
flatpak-builder --user --force-clean --repo=flatpak-repo flatpak-build packaging/io.github.nexusgx.NexusGX.yml
flatpak build-bundle flatpak-repo release/NEXUS-GX.flatpak io.github.nexusgx.NexusGX
```

Manifest używa lokalnego stagingu `release/linux-unpacked` oraz Zypak. Do publikacji na Flathub należy zweryfikować prawo do identyfikatora, dodać kontrolowany adres projektu, licencję i metadane wydania oraz przejść weryfikację aktualnych wymagań Flathub. Obecny manifest celuje w lokalny pakiet testowy.

## Podpisy i aktualizacje

Workflow Windows może korzystać z sekretów `NEXUS_WINDOWS_CERTIFICATE` i `NEXUS_WINDOWS_CERTIFICATE_PASSWORD`. Sprawdź podpis gotowego EXE przez `Get-AuthenticodeSignature`. Brak certyfikatu oznacza wersję testową bez deklarowanego podpisu.

Opcjonalny kanał powiadomień wymaga wartości `NEXUS_UPDATE_URL` (HTTPS) oraz `NEXUS_UPDATE_PUBLIC_KEY` (klucz publiczny Ed25519 w formacie PEM) podczas budowy. Podpisuj dokładne bajty JSON zawierającego `product` (`NEXUS GX`), `version` (trzy części liczbowe), `notes` oraz `expires` (czas UTC w milisekundach, maksymalnie 31 dni naprzód). Hostuj kopertę JSON z polami `payload` i `signature`, obydwoma w Base64. Klucz prywatny pozostaje u operatora wydania. Przeglądarka sprawdza podpis i pokazuje dostępność nowszej wersji. Instalacja odbywa się poprzez podpisany instalator lub menedżera pakietów.

Produkcyjne repozytoria Flatpak i APT, serwer ogłoszeń oraz kanał aktualizacji NSIS wymagają własnej domeny i kluczy wydawcy. Plik `downloads.json` na stronie pobierania powinien zawierać wyłącznie gotowe i zweryfikowane pakiety.
