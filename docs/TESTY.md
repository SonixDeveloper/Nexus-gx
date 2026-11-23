# Weryfikacja

- Testy jednostkowe obejmują adresy, walidację ustawień i filtrowanie hostów.
- Test integracyjny otwiera prawdziwą stronę HTTPS. Sprawdza załadowanie React, karty, brak Node.js i IPC w stronie, historię, zakładki, przywracanie kart i czyszczenie historii.
- W ramach odbioru uruchom testy na Windows 11 oraz Linux X11 i Wayland. Sprawdź również gotowe artefakty instalacyjne, skróty, protokoły, deinstalację i zachowanie aktywnego sandboxa.

## Test ręczny pakietu

1. Uruchom przeglądarkę z menu systemowego. Otwórz dwie różne strony HTTPS, przełącz karty, sprawdź Wstecz i Dalej, a następnie zamknij i przywróć kartę. Sprawdź osobno odrzucony certyfikat HTTPS i zablokowaną domenę.
2. Zmień motyw, skalę, język, tapetę oraz wyszukiwarkę. Po ponownym starcie sprawdź wygląd, ustawienia i sesję. Powtórz po awaryjnym zakończeniu po upływie czasu zapisu stanu.
3. Włącz ECO, ustaw minutę i odczekaj minutę po zmianie karty. Wybudź kartę i sprawdź jej adres. Otwórz Gaming Control Center i porównaj pomiary z menedżerem zadań, uwzględniając pamięć współdzieloną w sumie RSS.
4. Zapisz zakładkę i pobierz plik przez HTTPS. Anuluj kolejne pobranie i sprawdź status. Zweryfikuj portal zapisu w Flatpak.
5. Zaloguj się do kontrolnej witryny w zwykłym oknie. Otwórz dwa okna prywatne i sprawdź brak dostępu do cookies między trzema sesjami. Sprawdź odmowę uprawnień bez zgody, jawne nadanie dla HTTPS i cofnięcie zgody.
6. Wyczyść dane witryn, a potem użyj resetu ustawień i sprawdź stan po restarcie. Powtórz po wyłączeniu historii i po włączeniu czyszczenia podczas zamknięcia.
7. Zainstaluj, zarejestruj przeglądarkę w ustawieniach systemu i otwórz link HTTP(S) spoza aplikacji. Sprawdź działanie po odinstalowaniu. Skontroluj podpis EXE i kanał aktualizacji na podpisanych wydaniach.

## Wynik tej sesji

W środowisku roboczym brakuje Node.js, npm i flatpak-builder. DNS rejestru npm jest niedostępny. Próby `npm run build` i `npm test` zostały zatrzymane przed uruchomieniem poleceń. Weryfikacja uruchomieniowa Electron, instalacje i matryca systemowa pozostają do wykonania na runnerach.

Sprawdzono lokalnie składnię YAML, XML, pliku desktop i skryptu uruchamiającego Flatpak oraz obecność zasobów statycznej strony. AppStream wskazuje brak publicznej strony projektu i klasyfikacji treści, które pozostają do uzupełnienia przed zgłoszeniem do Flathub.
