# Bezpieczeństwo i prywatność

- Tylko zaufany dokument `nexus-ui://browser/index.html` w osobnej sesji otrzymuje most IPC. Handler schematu obsługuje wyłącznie zbudowane pliki interfejsu, a proces główny sprawdza tożsamość okna i głównej ramki dla każdego wywołania.
- Strony są otwierane w sandboxowanych WebContentsView z contextIsolation, aktywnym webSecurity, bez preloadu oraz bez integracji Node.js. Aplikacja przyjmuje tylko adresy HTTP i HTTPS bez osadzonych poświadczeń. Obsługa błędów Chromium nie omija błędów certyfikatów.
- Sesje prywatne używają odrębnych partycji w pamięci. Historia i adresy kart prywatnych nie są zapisywane w stanie aplikacji. Wybrane pliki pobierane na dysk i dane przesłane usługom sieciowym mogą pozostać poza przeglądarką.
- Kamera, mikrofon, lokalizacja i powiadomienia wymagają decyzji dla głównej ramki witryny HTTPS. Okna prywatne odrzucają te uprawnienia. Przechwytywanie ekranu jest odrzucane.
- Filtr domen pobiera [StevenBlack/hosts](https://github.com/StevenBlack/hosts) i [Block List Project](https://github.com/blocklistproject/Lists). Pobieranie list ujawnia adres IP ich dostawcom. Każde źródło zachowuje ostatnią poprawną wersję w osobnym cache. Brak dostępnej listy oznacza brak pokrycia danego źródła. Filtrowanie domen nie obejmuje wszystkich oszustw hostowanych pod wybranymi ścieżkami współdzielonych serwisów.
- Pliki z sieci wymagają HTTPS przez cały łańcuch przekierowań. Aplikacja przedstawia natywny dialog zapisu i sama nie uruchamia pobranych plików. Skanowanie plików pozostaje w gestii systemu.
- Stan sesji, zakładek oraz historii jest zapisywany w lokalnym pliku JSON, zastępowanym atomowo. Ten plik nie jest szyfrowany. Reset danych usuwa ustawienia, sesję, historię, zakładki, tapetę i dane witryn. Zapisane przez użytkownika pobrane pliki pozostają na dysku.
- Aplikacja nie wysyła własnej telemetrii. Standardowe kontakty internetowe Chromium, dostawców filtrów, wyszukiwarki i odwiedzanych witryn mają własne zasady prywatności.

Przed wydaniem należy zweryfikować wymuszenie sandboxa w każdym formacie i zaktualizować Electron do bieżącej wspieranej wersji.

Opcjonalna blokada nieszyfrowanych żądań jest stosowana do sesji stron. Po włączeniu zwykłe HTTP i WS są blokowane, także w oknach prywatnych. Stan połączenia Proton VPN jest dostępny w oficjalnym kliencie systemowym. Test adresu IP uruchamia użytkownik i adres trafia wtedy do Proton VPN.
