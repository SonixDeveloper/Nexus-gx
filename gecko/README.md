# NEXUS GX na Gecko

Budowa rozwojowa na przypiętej wersji źródeł Firefox ESR. Natywne okno XUL obsługuje karty, nawigację i rozszerzenia silnika Gecko. Nakładka używa osobnego identyfikatora programu, marki i katalogu profilu NEXUS GX. Menu **NEXUS GX** przenosi 20 palet z obecnego Theme Studio i zapisuje wybrany motyw w preferencjach Gecko. Kod Electron 0.1.2 pozostaje dostępny jako dotychczasowa wersja.

## Pobranie i przygotowanie

Z katalogu głównego projektu na Linuksie z uruchomionymi narzędziami Bash, Python, curl, GnuPG i tar:

```sh
bash gecko/fetch-source.sh
python3 gecko/prepare.py gecko/work/source
```

Skrypt sprawdza podpis manifestu SHA-512 kluczem wydawniczym Mozilla oraz sumę archiwum. Przed każdą aktualizacją ESR sprawdź [aktualne poprawki bezpieczeństwa](https://www.mozilla.org/en-US/security/known-vulnerabilities/firefox-esr/). Projekt używa marki NEXUS GX i zachowuje licencje plików Mozilla. Budowa z własnym identyfikatorem wymaga pełnej kompilacji natywnej.

## Kompilacja

Przygotuj środowisko według instrukcji [Mozilla dla Linuksa](https://firefox-source-docs.mozilla.org/setup/linux_build.html) lub [Mozilla dla Windows](https://firefox-source-docs.mozilla.org/setup/windows_build.html). Na Windows wykonuj polecenia w MozillaBuild. GitHub Actions automatycznie sprawdza przygotowanie źródeł i uruchamia pełną kompilację Linuksa dla PR z gałęzi migracji. Po wprowadzeniu workflow na domyślną gałąź można też uruchomić kompilację ręcznie.

```sh
cd gecko/work/source
export MOZCONFIG="$(cd ../.. && pwd)/mozconfig"
./mach build
./mach run
./mach package
```

Na Windows natywny instalator tworzy `./mach installer` po `./mach package`. Pakowanie ESR do AppImage, DEB i Flatpak wymaga osobnych konfiguracji dla Gecko. Bieżące instalatory 0.1.2 zawierają poprzednią wersję Electron.

## Zakres i weryfikacja

- Nakładka obejmuje identyfikator aplikacji, ikonę, palety i style kart oraz paska nawigacji. W kolejnym etapie trzeba przenieść widżety startowe, pełny edytor motywów, Gaming Control Center i import danych z wersji Electron.
- Oficjalne rozszerzenie [Proton VPN dla Firefox](https://protonvpn.com/support/browser-extensions) jest docelową metodą połączenia wewnątrz przeglądarki. Weryfikacja wymaga uruchomienia wersji Gecko, zainstalowania podpisanego rozszerzenia, zalogowania się na koncie Proton oraz porównania publicznego IP i ruchu DNS przed połączeniem, w trakcie i po przerwaniu połączenia.
- Logowanie Mozilla i synchronizacja wymagają autoryzacji i testów na oddzielnym profilu NEXUS GX.
- Własny mechanizm aktualizacji wymaga osobnej infrastruktury. Wersja rozwojowa nie przyjmuje aktualizacji binarnych Firefox i nie jest wydaniem produkcyjnym.
- Testy przygotowania nakładki uruchamia `python3 -m unittest discover -s gecko/tests`. Wydajność Gecko i Electron należy porównać na tych samych stronach i na tym samym sprzęcie.
