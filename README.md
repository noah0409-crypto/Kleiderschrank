# Kleiderschrank

Kleiderschrank ist jetzt auf einen echten nativen iPhone-Release-Weg ausgerichtet.

## Direkt in Xcode

Die richtige Datei zum Öffnen ist:

- [Kleiderschrank.xcodeproj](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank.xcodeproj)

Die SwiftUI-App selbst liegt in:

- [apps/ios/ios/Kleiderschrank](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank)

## Projektteile

- `apps/ios/ios`
  Das native Xcode-Projekt für die iPhone-App.
- `services/api`
  Das Online-Backend für Login, Uploads, Wetter, Feed und Daten.
- `render.yaml`
  Root-Blueprint für das Hosting des Backends auf Render.
- `docs`
  Struktur- und Release-Dokumentation.
- `archive`
  Alte Zwischenstände.

## Produktstand

- native SwiftUI-iPhone-App
- modernes Anthrazit-Weiß-Design
- neues App-Icon
- manuell einstellbare API-URL direkt in der App
- Upload von Kleidungsbildern
- Outfit-Vorschläge
- Feed, Likes, Kommentare und Profile
- Online-Backend für echte Nutzung außerhalb des WLANs

## Relevante Dateien

- [KleiderschrankApp.swift](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/App/KleiderschrankApp.swift)
- [RootView.swift](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Features/RootView.swift)
- [AppModel.swift](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Core/AppModel.swift)
- [Info.plist](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Info.plist)
- [App-Icon](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png)
- [Backend](/Users/noahbartholoma/Documents/New%20project/services/api/server.mjs)
- [Cloud Release Guide](/Users/noahbartholoma/Documents/New%20project/docs/CLOUD-RELEASE.md)

## Wichtig fuer TestFlight

Stand 28. April 2026 akzeptiert Apple fuer iPhone-Uploads zu App Store Connect nur Builds, die mit Xcode 26 oder neuer und dem iOS-26-SDK gebaut wurden. Ein lokales Xcode 14.2 reicht dafuer also nicht mehr fuer TestFlight oder App Store, auch wenn der Simulator lokal noch funktioniert.
