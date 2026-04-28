# Cloud Release

## Ziel

Diese App soll als echte iPhone-App auf einem echten iPhone laufen, auch wenn der lokale Mac kein aktuelles Xcode fuer TestFlight mehr bereitstellen kann.

## Realistischer Weg

1. GitHub-Repository mit diesem Projektstand befuellen.
2. Backend online auf Render deployen.
3. Die HTTPS-URL des Backends in der App eintragen oder in der App manuell setzen.
4. Das iOS-Projekt ueber Xcode Cloud oder einen aktuellen Cloud-Mac bauen.
5. Den Build in TestFlight verteilen.

## Warum das noetig ist

Das lokale Xcode 14.2 reicht fuer Simulator-Tests, aber nicht mehr fuer Uploads zu App Store Connect oder TestFlight. Fuer den eigentlichen Apple-Release wird aktuelles Apple-Tooling benoetigt.

## Render

- Repo mit Render verbinden
- `render.yaml` im Repo-Root verwenden
- `PUBLIC_BASE_URL` setzen
- Plan mit Persistent Disk verwenden

## App

- Xcode-Projekt: `apps/ios/ios/Kleiderschrank.xcodeproj`
- API in der App:
  - Standardwert aus `Info.plist`
  - ueberschreibbar direkt in der App ueber die Server-Einstellung

## TestFlight

- Apple Developer Program erforderlich
- aktuelles Apple-Buildsystem erforderlich
- nach erfolgreichem Upload erfolgt Verteilung ueber TestFlight-Gruppen oder oeffentlichen Link
