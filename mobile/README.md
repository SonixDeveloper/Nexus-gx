# NEXUS GX Mobile

Osobna aplikacja przeglądarki na Androida, iPhone’a i iPada. Android renderuje strony przez systemowy Android WebView. iOS oraz iPadOS używają WKWebView. Interfejs obsługuje do ośmiu kart, nawigację, wyszukiwanie, skróty i wybór akcentu. Adresy sesji pozostają w pamięci aplikacji. Mechanizmy przechowywania cookies i innych danych witryn zapewnia systemowy widok WWW.

Wersja mobilna otwiera strony HTTPS. Synchronizacja z pulpitem, rozszerzenia i zintegrowane VPN pozostają poza zakresem tego wydania.

## Uruchamianie programu

```sh
cd mobile
npm install
npm run typecheck
npm test
npm start
```

GitHub Actions generuje Android APK do testów oraz aplikację na symulator iOS. Android APK z CI jest podpisany kluczem testowym. Instalacja na fizycznym iPhonie lub iPadzie wymaga osobnej kompilacji urządzeniowej, profilu podpisywania Apple i dystrybucji przez Xcode, TestFlight albo App Store.

APK i paczka na symulator znajdują się w artefaktach workflow po pomyślnej kompilacji.

## Miniodtwarzacz

Uruchom odtwarzanie i otwórz drugą kartę. Panel pod paskiem adresu pozwala wstrzymać dźwięk, wznowić go lub wrócić do karty źródłowej. Działa z odtwarzaczami HTML5 w głównym dokumencie, gdy NEXUS GX pozostaje na ekranie.
