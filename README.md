# Zoop

P2P File-Sharing über Nostr – wie Blip, aber auf Nostr-Basis. Keine Registrierung, nur Nostr-Extension (z. B. Alby/nos2x).

## Tech-Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Nostr:** nostr-tools
- **P2P:** simple-peer (WebRTC)
- **Verschlüsselung:** NIP-44 (nostr-tools) für Signaling

## Entwicklung

```bash
npm install
npm run dev
```

Öffne [http://localhost:5173](http://localhost:5173).

## Build & Preview

```bash
npm run build
npm run preview
```

## Deployment (GitHub Pages)

1. Repo auf GitHub pushen.
2. In **Settings → Pages** Source auf **GitHub Actions** (oder **main** / `dist`) setzen.
3. Für Vite: `vite.config.ts` anpassen, z. B. `base: '/Zoop/'` (Repo-Name).

## Projektstruktur

```
src/
  components/   # LoginButton, FileSelector, RecipientInput, TransferProgress, IncomingRequest
  hooks/       # useNostr, useWebRTC
  utils/       # nostr, webrtc, crypto
  App.tsx
  main.tsx
```

## Voraussetzungen

- Browser mit Nostr-Extension (NIP-07), z. B. [Alby](https://getalby.com) oder [nos2x](https://github.com/fiatjaf/nos2x).

## Lizenz

MIT
