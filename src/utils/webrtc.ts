/**
 * WebRTC-Hilfsfunktionen für P2P-Dateiübertragung
 * Nutzt simple-peer für DataChannel-basierte Übertragung.
 */

import SimplePeer from 'simple-peer'

export type PeerOptions = {
  initiator: boolean
  trickle?: boolean
  config?: RTCConfiguration
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
}

export function createPeer(options: PeerOptions): SimplePeer.Instance {
  const peer = new SimplePeer({
    initiator: options.initiator,
    trickle: options.trickle ?? false,
    config: options.config ?? {},
    ...(options.offer && { offer: options.offer }),
    ...(options.answer && { answer: options.answer }),
  })
  return peer
}

export function createDataChannelPeer(initiator: boolean): SimplePeer.Instance {
  return new SimplePeer({
    initiator,
    trickle: false,
    config: {},
  })
}

export async function getOffer(peer: SimplePeer.Instance): Promise<RTCSessionDescriptionInit> {
  return new Promise((resolve, reject) => {
    peer.on('signal', (data: RTCSessionDescriptionInit) => {
      if (data.type === 'offer') resolve(data)
    })
    peer.on('error', reject)
  })
}

export async function getAnswer(peer: SimplePeer.Instance): Promise<RTCSessionDescriptionInit> {
  return new Promise((resolve, reject) => {
    peer.on('signal', (data: RTCSessionDescriptionInit) => {
      if (data.type === 'answer') resolve(data)
    })
    peer.on('error', reject)
  })
}
