# Inventar vizual local — fără dovadă de publicare

Inventariat și decodat cu `sharp` la 09.10.2026. Nu sunt create sau modificate imagini; designul și identitatea existente rămân păstrate.

| Fișier existent în repository | Dimensiuni / alpha | Utilizare și limită |
|---|---|---|
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 1024×1024 PNG, fără alpha | Iconul Capacitor iOS existent, declarat universal în Contents.json; numele fișierului nu indică dimensiunea reală |
| `public/apple-touch-icon.png` | 180×180 PNG, alpha | Icon web Apple touch; nu înlocuiește iconul store 1024 |
| `public/icons/icon-512x512.png` | 512×512 PNG, alpha | Icon web; acceptanța specifică Google și brandul din build se verifică înainte de upload |
| `public/icons/icon-192x192.png` | 192×192 PNG, alpha | Icon PWA |
| `mobile/assets/icon-ios-1024.png` | 1024×1024 PNG, fără alpha | Asset al proiectului Expo separat; nu dovedește că un build Capacitor îl folosește |
| `mobile/assets/icon-android-foreground.png` | 1024×1024 PNG, alpha | Foreground Expo/adaptive; nu este captură de ecran și nu dovedește iconul final AAB |

Iconul Capacitor iOS a fost inspectat vizual: literă N albă pe fond verde. Nu este nevoie de înlocuirea brandului pentru pregătirea tehnică.

## Capturi locale existente

`/workspace/nitido-qa-results/public-390.png`, `pro-viewer-390.png` și `operator-390.png` sunt PNG-uri 390×900 din browserul QA. Directorul conține și viewporturi 360/430/768/1024/1440 pentru validare responsive, cu date sintetice. Raportul QA și proveniența lor se consultă separat.

Aceste imagini sunt dovezi locale ale aspectului web. **Nu sunt capturi ale aplicației instalate pe iOS/Android și nu sunt materiale finale trimise magazinelor.** Exemplul 390×900 depășește și raportul maxim 2:1 din specificația Google consultată. Nu se etichetează ca iPhone screenshot și nu se redimensionează pentru a fabrica o probă mobilă.

Materialele finale cer capturi din buildul candidat semnat și servit de backendul verificat, pe dispozitive/simulatoare conforme dimensiunilor oficiale. Se folosesc conturi și date sintetice; se evită ecrane interne Operator/Super Admin în fișa publică și funcții Pro/push/plată nedemonstrate.

Storyboard propus după probe: configurare rezervare, alegere ofertă Standard, detaliu rezervare și etape, calendar firmă. Acesta este plan de captură; fișierele nu sunt încă produse. Feature graphic Google și orice preview video final rămân nepregătite, fără substituire prin capturi web.
