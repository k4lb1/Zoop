# ⚡ Zoop

**P2P file sharing over Nostr** – send files directly from browser to browser, no server in the middle. Nostr extension (e.g. Alby or nos2x) required.

---

## Features

- **Nostr login** (NIP-07) – connect via browser extension
- **WebRTC P2P** – files go directly between two browsers (no server sees the file)
- **Trickle ICE** – ICE candidates sent over Nostr for better NAT/firewall handling
- **NIP-44** – WebRTC offer/answer and ICE candidates encrypted over Nostr
- **Custom event kinds** – 30333 Offer, 30334 Answer, 30335 ICE candidate
- **STUN + TURN** – Google STUN, OpenRelay + FreeTurn as fallback
- **Drag & drop** – file selection, progress with MB/s and ETA
- **64 KB chunks** – chunk-based progress for large files
- **Browser notifications** – when a new file offer arrives
- **Relay** – uses `wss://nos.lol` only (configurable in `src/utils/nostr.ts`)

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
- **Network:** WebRTC uses STUN and TURN (OpenRelay, FreeTurn). If you see ICE/connection timeouts, try another network or disable VPN/firewall.

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
│   ├── utils/          # nostr (relays, kinds), crypto (NIP-44), webrtc (simple-peer helpers)
│   ├── App.tsx         # Send/accept flow, Nostr signaling (30333/30334/30335), error display
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
| **Sender: No answer (35 s)** | "No answer from recipient within 35s. Check Nostr relay or that the recipient is online." Subscription for answer/ICE is closed. |
| **Sender: Answer received, no connect (45 s)** | "WebRTC did not connect within 45s (answer was received). Try two different devices or another network. Check console (F12)." Peer destroyed, subscription closed. |
| **Receiver: No connect (60 s)** | "WebRTC connection did not establish within 60s. Try two different devices or another network. Check console (F12)." Peer destroyed, ICE subscription closed. |
| **ICE connection failed** | Shown with hint to try another network or disable VPN/firewall. Full error and stack in console (F12). |
| **Publish / relay failure** | "Could not publish event." or relay errors in console. |
| **General errors** | Message derived from `error.message`; empty/undefined fall back to "Connection failed" or "Something went wrong." so something is always shown. |

All timeouts destroy the WebRTC peer and (where applicable) unsubscribe from Nostr to avoid leaks and follow-up errors.

---

## License

MIT
