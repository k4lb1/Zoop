# ⚡ Zoop

**P2P file sharing over Nostr** – send files directly from browser to browser. Prefer WebRTC; if the connection fails (e.g. mobile/cellular), an encrypted fallback via 0x0.st runs automatically. Nostr extension (e.g. Alby or nos2x) required.

**Status:** Early development (v0.0.x). This software has not undergone a security or cryptography review. Use at your own risk; treat it as experimental.

---

## Features

- **Nostr login** (NIP-07) – connect via browser extension
- **WebRTC P2P** – files go directly between two browsers (no server sees the file)
- **Trickle ICE** – ICE candidates sent over Nostr for better NAT/firewall handling
- **NIP-44** – WebRTC offer/answer and ICE candidates encrypted over Nostr
- **Custom event kinds** – 30333 Offer, 30334 Answer, 30335 ICE candidate, 30340 Fallback (0x0)
- **STUN + TURN** – Google STUN, FreeTurn (UDP/TLS). Optional: [Metered Open Relay](https://www.metered.ca/tools/openrelay/) via build-time env (see below).
- **0x0.st fallback** – if WebRTC/ICE fails, file is encrypted (AES-GCM), uploaded to 0x0.st (24h), link + key sent via Nostr (kind 30340). **Note:** 0x0.st blocks many deployed origins (CORS); fallback works from localhost. Alternatives: run your own minimal upload endpoint (e.g. Cloudflare Worker, Vercel serverless) that accepts POST and returns a one-time URL, and point the app at it; or use another ephemeral host that allows CORS from your domain.
- **Drag & drop** – file selection, progress with MB/s and ETA
- **64 KB chunks** – chunk-based progress for large files
- **Browser notifications** – when a new file offer arrives
- **Relay** – default relays nos.lol and nostr.land (toggle in footer; config in `src/utils/nostr.ts`)

---

## Tech stack

| Area       | Technology |
|-----------|------------|
| Frontend  | React 18, Vite, TypeScript |
| Styling   | Tailwind CSS + inline styles |
| Nostr     | [nostr-tools](https://github.com/nostr-dev-kit/nostr-tools) |
| P2P       | [simple-peer](https://github.com/feross/simple-peer) (WebRTC) |
| Encryption| NIP-44 (nostr-tools) |

---

## Requirements

- **Browser** with a Nostr extension (NIP-07), e.g. [Alby](https://getalby.com) or [nos2x](https://github.com/fiatjaf/nos2x)
- **NIP-44** in the extension for encrypted signaling (offer/answer/ICE)
- **Network:** WebRTC uses STUN and TURN (FreeTurn). If it fails (e.g. iPhone on cellular), the app automatically uses the 0x0.st fallback (encrypted upload, link via Nostr). You can toggle Nostr relays (e.g. nos.lol, nostr.land) in the footer.

---

## Optional: Metered TURN

To use your own [Metered Open Relay](https://www.metered.ca/tools/openrelay/) for all users: copy `.env.example` to `.env`, set `VITE_METERED_TURN_USERNAME` and `VITE_METERED_TURN_CREDENTIAL` (from the static iceServers config in the Metered dashboard), then build. Credentials end up in the built JS; for free tier the risk is low (only your TURN quota can be used). For GitHub Pages, set these as repository secrets and pass them as env vars in your build workflow.

---

## Install & run

```bash
git clone https://github.com/k4lb1/Zoop.git
cd Zoop
npm install
npm run dev
```

Open **http://localhost:5173** (or the port shown).

**Live (GitHub Pages):** https://k4lb1.github.io/Zoop/

---

## Build & preview

```bash
npm run build
npm run preview
```

---

## Project structure

```
Zoop/
├── src/
│   ├── components/     # UI: LoginButton, FileSelector, RecipientInput, TransferProgress, IncomingRequest
│   ├── hooks/          # useNostr (relays, publish, subscribe), useWebRTC (Trickle ICE, send/receive)
│   ├── utils/          # nostr (relays, kinds), crypto (NIP-44), fallback0x0 (encrypt/upload/0x0.st), webrtc (simple-peer helpers)
│   ├── App.tsx         # Send/accept flow, Nostr signaling (30333/30334/30335), fallback (30340), error display
│   ├── ErrorBoundary.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## Error handling

| Situation | Behaviour |
|-----------|-----------|
| **No Nostr extension** | Message in UI; connect not possible without extension. |
| **Invalid npub / no recipient or file** | Inline error under the send form. |
| **Sender: No answer (90 s)** | "No answer from recipient within 90s. Check Nostr relay or that the recipient is online." Subscription closed. |
| **Sender: Answer received, no connect (60 s)** | "WebRTC did not connect within 60s (answer was received). Try WiFi or another network." Peer destroyed, subscription closed. **Then automatic 0x0.st fallback:** file is encrypted, uploaded, link sent via Nostr (kind 30340). |
| **Receiver: No connect (60 s)** | "WebRTC connection did not establish within 60s. Try two different devices or another network." Peer destroyed, ICE subscription closed. |
| **ICE connection failed** | **Automatic 0x0.st fallback** (encrypted upload, Nostr event 30340). |
| **Publish / relay failure** | "Could not publish event." or relay errors in console. |
| **General errors** | Message derived from `error.message`; empty/undefined fall back to "Connection failed" or "Something went wrong." so something is always shown. |

All timeouts destroy the WebRTC peer and (where applicable) unsubscribe from Nostr to avoid leaks. When the sender hits an ICE/connection failure, the app automatically switches to the 0x0.st fallback (no user action required); the recipient receives the file via a Nostr event (kind 30340) and downloads from 0x0.st after decryption.

---

## License

MIT
