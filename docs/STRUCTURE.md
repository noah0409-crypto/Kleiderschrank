# Projektstruktur

## Ziel

Die Struktur ist jetzt release-orientiert aufgebaut: Die native iPhone-App steht im Mittelpunkt, das Backend ist als eigener Online-Service getrennt.

## Ordner

`apps/ios`
- nativer iPhone-App-Bereich
- relevant fuer den echten Release ist `apps/ios/ios` mit dem Xcode-Projekt
- die fruehere Expo-Version ist archiviert und nicht mehr Teil des aktiven Produkts

`services/api`
- Online-Backend fuer Auth, Uploads, Outfit-Daten, Feed und Wetter
- Render-Deployment und persistente Datenablage

`render.yaml`
- Root-Blueprint fuer Render im Monorepo
- setzt `rootDir: services/api`

`docs`
- Architektur- und Release-Dokumentation

`archive`
- alte oder verworfene Zwischenstaende

## Warum diese Struktur

- Die App kann unabhaengig vom Backend weiterentwickelt werden.
- Deployment und Release-Tasks sind klar getrennt.
- Der Projektstamm bleibt uebersichtlich.
- GitHub, Render und Xcode-Cloud lassen sich einfacher auf denselben Repo-Stand aufsetzen.
