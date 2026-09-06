# Roadmap

Produkt-Roadmap für die Rezepte-App, basierend auf einer Analyse des aktuellen
Funktionsumfangs (Stand: 2026-09-05). Fokus liegt auf den drei Kernbereichen
Rezepte, Nährwerte und Meal Prep, plus der Plattform drumherum.

## Aktueller Funktionsumfang

**Rezepte & Kochbücher**
- Rezepte mit Kategorien, Bildern, Portionen, Zeiten, Schritten
- Komponenten-System: feste oder wählbare Bestandteile (z. B. Sauce-Varianten),
  auch rekursiv auf andere Rezepte verlinkbar
- Zwei Nährwert-Modi pro Rezept (einfach / erweitert je Zutat)
- Kochbücher mit Sharing per Link/Token und mit Freunden
- Cook-Mode-Ansicht, Zufalls-Rezept, PDF-Export von Kochbüchern
- Community-Tab zum Entdecken/Importieren fremder Rezepte

**Nährwerte**
- Eigene Zutaten-Datenbank pro User (Kalorien/Makros, Dichte für g↔ml)
- Barcode-Import über OpenFoodFacts inkl. Quellen-Tracking
- Tagesziele mit Verlauf (`target_history`), Kalorienbereich, Nährwert-Score
  (Protein-Faktor-Farbcodierung), Körpermaße/Gewichtsverlauf

**Meal Prep & Planung**
- Wochenplaner mit Slots (Drag & Drop von Rezepten/Zutaten/Komponenten)
- Batch-Cook-Sheet und Batch-Planung über mehrere Tage/Slots
- Schnelleinträge (Quick-Entry-Templates), Beilagen-Migration
- Automatisch generierte Einkaufsliste aus Planer-Einträgen
- Lokale Mahlzeiten-Vorschlagslogik (`mealSuggestions.ts`)

**Community & Gamification**
- Punkte, Achievements, Rang-System (Bronze bis Unreal, mit Icons)
- Seasons mit Historie/Vergleich, Freunde & Freundesvergleich, Streak-Heatmap

**Plattform**
- PWA (offline-fähig) und seit Kurzem eine native Android-Hülle via Capacitor
- Theme-Einstellung, Username-System, Account-Verwaltung (Export, Löschen),
  rechtliche Seiten (AGB, Datenschutz, Impressum)

**Bemerkenswert:** Es existiert bereits ein Typ-Grundgerüst für
KI-Mahlzeiten-Vorschläge (`aiSuggestions.functions.ts`), das aktuell bewusst
per Feature-Flag deaktiviert ist, weil kein Server-/Gateway-Anschluss mehr
existiert. Das ist eine naheliegende Vorarbeit für Ausbaustufe 2.

## Ausbaustufe 1 — Bestehendes vervollständigen

Ziel: Lücken in den drei Kernbereichen schließen, die mit der jetzigen
Architektur direkt umsetzbar sind.

- **Rezepte:** Bewertungen/persönliche Notizen an eigenen Rezepten; Rezept-Import
  per URL (Titel/Zutaten/Schritte aus einer eingefügten Rezept-Webseite
  vorausfüllen)
- **Nährwerte:** Mikronährstoffe (Ballaststoffe, Zucker, Salz, Vitamine) neben
  den bestehenden Makros; Barcode-Scan direkt über die Handykamera statt
  manueller Eingabe, jetzt möglich durch die native Android-App
- **Meal Prep:** Wiederkehrende Wochenpläne (eine Woche als Vorlage speichern
  und erneut anwenden); automatische Vervollständigung eines Plans anhand der
  Tagesziele, aufbauend auf `mealSuggestions.ts`
- **Plattform:** Push-Benachrichtigungen (Streak-Erinnerung, Meal-Prep-Reminder)
  über Capacitor, da die Android-Hülle jetzt steht

## Ausbaustufe 2 — Automatisierung & KI

Ziel: Wiederkehrende manuelle Arbeit (Planen, Erfassen, Einkaufen) durch
Automatisierung abnehmen.

- **Rezepte:** KI-Mahlzeiten-Vorschläge reaktivieren und an einen echten
  Server-Gateway anbinden (Typen sind bereits vorbereitet); Ersatz-Vorschläge
  bei fehlenden Zutaten
- **Nährwerte:** Foto-basierte Kalorienschätzung einer Mahlzeit (Kamera →
  geschätzte Makros) als schnelle Alternative zur manuellen Zutatenerfassung
- **Meal Prep:** Kalorienbudget-Ausgleich über die Woche (Tage mit Über-/
  Unterschuss automatisch gegenrechnen); Einkaufsliste nach Supermarkt-
  Kategorien sortieren/optimieren
- **Community:** Öffentlicher Such-/Explore-Feed für Community-Rezepte mit
  Bewertungen, über das bestehende Import-Zählersystem hinaus

## Ausbaustufe 3 — Plattform-Wachstum

Ziel: Reichweite und Bindung, wenn die Kernfunktionen stabil und automatisiert
sind.

- **iOS-Version** über Capacitor (`@capacitor/ios`) neben der bestehenden
  Android-Hülle
- **Wearable-/Health-Integration** (Apple Health, Google Fit) für Trainings-
  Kalorien, die in die Tagesbilanz einfließen
- **Mehrsprachigkeit** – App und PWA-Manifest sind aktuell fest auf Deutsch
  ausgelegt
- **Community-Skalierung**: Kommentare, Trend-/Explore-Rankings, evtl.
  Premium-Stufe für erweiterte Funktionen (z. B. KI-Kontingent), falls
  Monetarisierung gewünscht ist

## Frühere technische Meilensteine (erledigt)

Diese Punkte standen vorher in dieser Datei und sind bereits abgeschlossen:

- [x] Trace all meal-plan entry query filters and range handling
- [x] Fix complete entry and recursive ingredient aggregation
- [x] Add a concrete regression test covering all slots, days, and component variants
- [x] Verify the generated shopping list against raw planner entries
