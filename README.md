# BKK Figyelő

Mobilra optimalizált React PWA a budapesti járatok következő érkezéseinek
figyelésére. A felhasználó csoportokat hozhat létre, csoportonként járat +
megálló párokat menthet, majd az adatokat ömlesztett vagy járatonkénti nézetben
láthatja.

## Funkciók

- csoportok létrehozása és törlése;
- BKK FUTÁR keresés járatra és megállóra;
- a következő három érkezés megjelenítése figyelt járatonként;
- összesített, időrendbe rendezett nézet;
- járatonként csoportosított nézet;
- járatok elrejtése és visszakapcsolása lenyíló jelölőnégyzet-listából;
- nem mentett gyors keresés járatra, irányra és megállóra;
- valós idejű és menetrend szerinti idők megkülönböztetése;
- konfiguráció mentése a böngésző localStorage-ába;
- járatcsoportok JSON-exportja és -importja API-kulcs megosztása nélkül;
- mobil-first felület BKK/BKV színkódokkal;
- telepíthető PWA és GitHub Pages deploy workflow.

## Fejlesztés

```bash
npm install
npm run dev
```

Az API-kulcsot kétféleképpen lehet megadni:

1. a `.env.local` fájlban `VITE_BKK_API_KEY` változóként;
2. az alkalmazás Beállítások oldalán.

A `.env.local` fájl nem kerülhet commitba. A kulcs nélkül az alkalmazás csak a
Beállítások oldalon használható; a BKK API keresése és az élő érkezések mellett
a csoportkezelés is kulcsot igényel.

## Build és deploy

```bash
npm run build
npm run preview
```

A `.github/workflows/deploy.yml` a `main` ágra push után GitHub Pages-re
telepít. A repository GitHub Settings / Secrets and variables / Actions
oldalán opcionálisan létrehozható egy `BKK_API_KEY` nevű secret. A workflow
ezt `VITE_BKK_API_KEY` változóként adja át a buildnek.

## API-kulcs és GitHub Pages

A GitHub Pages statikus tárhely. A böngészőből közvetlenül használt API-kulcs
nem tekinthető titkosnak: a felhasználó a hálózati kérésekből vagy a buildből
kiolvashatja. Ezért csak olyan, frontendből használatra engedélyezett BKK
kulcsot szabad beállítani.

Ha a kulcsot valóban el kell rejteni, a későbbi verzióhoz külön szerveroldali
proxy szükséges, például Cloudflare Worker, Vercel Function vagy saját
backend. Ezt a GitHub Pages önmagában nem tudja biztosítani.

## Források

- [BKK FUTÁR OpenAPI](https://opendata.bkk.hu/docs/futar-openapi.yaml)
- [BKK arculat és színek](https://bkk.hu/bkk-partnerek/egyeb/logo-es-arculat/)
