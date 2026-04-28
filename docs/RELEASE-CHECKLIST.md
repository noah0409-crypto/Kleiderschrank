# Release-Checkliste iPhone-App

## 1. Backend online bringen

- Root-Repo nach GitHub pushen
- Render mit [render.yaml](/Users/noahbartholoma/Documents/New%20project/render.yaml) verbinden
- `PUBLIC_BASE_URL` auf die echte HTTPS-URL setzen
- Uploads und Datenbank auf persistentem Speicher halten
- die Live-URL in der App bei Bedarf direkt ueber die Server-Einstellung testen

## 2. App visuell finalisieren

- finales App-Icon erstellen
- Splash-Screen-Assets anlegen
- echte Beispielinhalte und Profilbilder testen
- Copy und Fehlermeldungen final ueberarbeiten

## 3. Apple-Vorbereitung

- Apple-Developer-Konto
- Bundle Identifier final pruefen
- App-Name und Untertitel festlegen
- Datenschutzangaben und Berechtigungen dokumentieren

## 4. iOS-Build

- fuer lokalen Simulator: `apps/ios/ios/Kleiderschrank.xcodeproj` mit Xcode oeffnen
- fuer TestFlight/App Store: Cloud-Build mit aktuellem Apple-Tooling nutzen
- Release-API als HTTPS-URL in der App setzen

Wichtig:
- Stand 28. April 2026 verlangt Apple fuer iOS-Uploads nach App Store Connect Xcode 26 oder neuer mit iOS-26-SDK.

## 5. TestFlight

- Build ueber Xcode Cloud oder einen anderen Mac/Cloud-Mac mit aktuellem Xcode 26 erzeugen
- Build in TestFlight hochladen
- Upload, Login, Kamera, Wetter und Social-Flow auf echtem iPhone testen
- Safe Areas auf mehreren iPhone-Groessen pruefen

## 6. App Store

- Screenshots erstellen
- App-Beschreibung schreiben
- Keywords und Kategorie setzen
- Datenschutzformular ausfuellen
