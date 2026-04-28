# Kleiderschrank iOS

Die echte native iPhone-App liegt jetzt direkt als Xcode-Projekt hier:

- [Kleiderschrank.xcodeproj](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank.xcodeproj)

## Sofort in Xcode öffnen

1. Xcode starten
2. [Kleiderschrank.xcodeproj](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank.xcodeproj) öffnen
3. links das Projekt `Kleiderschrank` auswählen
4. unter `Signing & Capabilities` dein Apple Team setzen
5. oben Simulator oder dein iPhone wählen
6. `Play` drücken

## Wichtige Dateien

- [KleiderschrankApp.swift](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/App/KleiderschrankApp.swift)
- [RootView.swift](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Features/RootView.swift)
- [AppModel.swift](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Core/AppModel.swift)
- [Info.plist](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Info.plist)
- [App Icon](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png)

## Backend

Die App nutzt das Online-Backend aus:

- [services/api/server.mjs](/Users/noahbartholoma/Documents/New%20project/services/api/server.mjs)

Die API-URL stellst du in [Info.plist](/Users/noahbartholoma/Documents/New%20project/apps/ios/ios/Kleiderschrank/Info.plist) über `APIBaseURL` ein.

## Hinweis

Der frühere Expo-/React-Native-Zwischenstand wurde nach [archive/expo-prototype](/Users/noahbartholoma/Documents/New%20project/archive/expo-prototype) verschoben. Für die echte iPhone-App ist jetzt nur noch `apps/ios/ios` relevant.
