# ⚡ Zoop

**P2P file sharing over Nostr** – send files directly from browser to browser, no server in the middle. No sign-up, just a Nostr extension (e.g. Alby or nos2x).

> **100% Vibecode** – i dont know what iam doing

---

## Features

- **Nostr login** (NIP-07) – connect via browser extension only
- **WebRTC P2P** – files go directly between two browsers (no server sees the file)
- **NIP-44** – WebRTC offer/answer encrypted over Nostr relays
- **Custom event kinds** (30333 Offer, 30334 Answer) for signaling
- **Drag & drop** – multiple files, progress with MB/s and ETA
- **64 KB chunks** – large files, chunk-based progress tracking
- **Browser notifications** – alert when a new file arrives
- **Mobile-friendly** – touch-friendly buttons, responsive layout

---

## Screenshot

---


## Tech stack

| Area           | Technology |
|----------------|------------|
| Frontend       | React 18, Vite, TypeScript |
| Styling        | Tailwind CSS + inline styles (fallback) |
| Nostr          | [nostr-tools](https://github.com/nostr-dev-kit/nostr-tools) |
| P2P            | [simple-peer](https://github.com/feross/simple-peer) (WebRTC) |
| Encryption     | NIP-44 (nostr-tools) |

---

## Requirements

- **Browser** with a Nostr extension (NIP-07), e.g. [Alby](https://getalby.com) or [nos2x](https://github.com/fiatjaf/nos2x)
- **NIP-44** support in the extension is recommended (for encrypted signaling)

---

## Install & run

```bash
# Clone the repo
git clone https://github.com/k4lb1/Zoop.git
cd Zoop

# Install dependencies
npm install

# Start dev server
npm run dev
```

Then open **http://localhost:5173** in your browser (or the port shown, e.g. 5174).

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
│   ├── components/   # LoginButton, FileSelector, RecipientInput, TransferProgress, IncomingRequest
│   ├── hooks/        # useNostr, useWebRTC
│   ├── utils/        # nostr, webrtc, crypto
│   ├── App.tsx
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

| Situation            | Behavior |
|----------------------|----------|
| No Nostr extension   | Message in UI, Connect button disabled |
| WebRTC failed       | Error message, state set to "error" |
| Recipient offline    | 30 second timeout, then error message |
| Connection setup     | 30 s timeout for offer/answer |

---

## License

MIT

---

**100% Vibecode** – i dont know what iam doing · Zoop – P2P file sharing over Nostr
