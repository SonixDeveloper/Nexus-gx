# NEXUS GX

NEXUS GX 0.1.0 to kod wersji rozwojowej przeglądarki desktopowej opartej na Electron 45.4.1 i Chromium. Karty korzystają z natywnych widoków WebContentsView. Interfejs tworzą React, TypeScript, Vite, Tailwind CSS, Zustand, Motion i Lucide.

## Uruchomienie

Wymagany jest Node.js 24 z npm oraz dostęp do npm i dystrybucji Electron. Używaj aktualizowanego Windows 11 x64 lub Linuksa x86_64 z działającym sandboxem Chromium. Windows 10 pozostaje poza deklarowanym wsparciem projektu.

```sh
npm install
npm run dev
```

`npm run dev` kompiluje aplikację i uruchamia okno Electron. Ustawienia i sesja głównego okna są zapisywane w katalogu danych aplikacji Electron. Strona pobierania jest osobnym projektem w [site](site/README.md).

## Kompilacja i testy

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
```

Test integracyjny wymaga środowiska graficznego i połączenia z `https://example.com/`. W CI Linux używa Xvfb z aktywnym sandboxem. Zobacz [instrukcję testów](docs/TESTY.md), [architekturę](docs/ARCHITEKTURA.md) i [opis bezpieczeństwa](docs/BEZPIECZENSTWO.md).

## Pakietowanie

| Platforma | Polecenie | Nazwa docelowa |
| --- | --- | --- |
| Windows 11 x64 | `npm run dist:win` | `NEXUS-GX-Setup.exe` |
| Linux x86_64 | `npm run dist:linux` | `NEXUS-GX-x86_64.AppImage`, `nexus-gx_amd64.deb` |
| Linux x86_64 | [flatpak-builder](docs/WYDANIA.md) | `NEXUS-GX.flatpak` |

Workflow GitHub Actions ma budować i przesyłać artefakty testowe. W tej sesji nie wygenerowano instalatorów. Szczegóły instalacji i wydań znajdują się w [docs/WYDANIA.md](docs/WYDANIA.md).

## Stan 0.1.0

W kodzie są nawigacja HTTP(S), poziome i pionowe karty, przeciąganie, etykiety grup, przestrzenie robocze, przypinanie, wyciszanie, przywracanie zamkniętych kart, wiele okien, przywracanie sesji głównego okna, historia, zakładki z folderami i importem HTML, wyszukiwanie na stronie i menedżer pobierania. Są także Theme Studio, osiem motywów, import i eksport ustawień motywu, tapety statyczne, GIF i wideo, profile wydajności z usypianiem kart oraz pomiary procesów. Ochrona prywatności obejmuje osobne sesje w pamięci, filtry domen z wyjątkami, uprawnienia per witryna HTTPS, czyszczenie i ograniczenie UDP WebRTC.

Do kolejnych iteracji pozostają podglądy kart, zaawansowane komponowanie strony startowej, ustawienia własnych ikon, edytowalne skróty, blokowanie ciasteczek stron trzecich, Picture-in-Picture i konfiguracja produkcyjnych kanałów dystrybucji. Tryb ECO skraca czas usypiania kart, a profile nie ustawiają systemowych limitów CPU ani RAM.
