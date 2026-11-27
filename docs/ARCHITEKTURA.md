# Architektura NEXUS GX

Proces główny zarządza oknami, kartami, sesjami Chromium, pobieraniem i plikami lokalnymi. Każda strona działa w osobnym WebContentsView bez preloadu i bez integracji Node.js. React i Zustand obsługują wyłącznie interfejs aplikacji. Minimalny preload przekazuje polecenia z głównej ramki zaufanego dokumentu. Wszystkie adresy internetowe przechodzą walidację w procesie głównym.

Stan interfejsu trafia do pliku JSON przez atomowe zastąpienie. Dane stron Chromium mają własną partycję. Profile mają własne katalogi danych i partycje po przełączeniu oraz ponownym uruchomieniu. Przestrzenie robocze grupują karty wewnątrz jednego profilu. Każde okno prywatne używa odrębnej partycji w pamięci. Nieaktywna karta może zwolnić renderer i odtworzyć ostatni adres po wybudzeniu.

Kolejność wdrożenia: prawdziwa nawigacja i karty → interfejs i motywy → ochrona sesji i wydajność → zarządzanie danymi → paczki oraz weryfikacja systemowa.
