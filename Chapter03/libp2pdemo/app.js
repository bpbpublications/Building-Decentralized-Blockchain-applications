const Libp2p = require('libp2p')
const WebSockets = require('libp2p-websockets')
const SECIO = require('libp2p-secio')
const MPLEX = require('libp2p-mplex')
const Bootstrap = require('libp2p-bootstrap')

// Known peers addresses
const bootstrapMultiaddrs = [
  '/dns4/ams-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
  '/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3'
]

async function startNode() {
const node = await Libp2p.create({
  modules: {
    transport: [WebSockets],
    connEncryption: [SECIO],
    streamMuxer: [MPLEX],
    peerDiscovery: [Bootstrap]
  },
  config: {
    peerDiscovery: {
      autoDial: true,
      [Bootstrap.tag]: {
        enabled: true,
        list: bootstrapMultiaddrs // provide array of multiaddrs
      }
    }
  }
})

node.on('peer:discovery', (peer) => {
  console.log('Discovered %s', peer.id.toB58String()) // Log discovered peer
})

node.on('peer:connect', (peer) => {
    console.log('Connected to %s', peer.id.toB58String()) // Log connected peer
  })

// start libp2p
await node.start()
}

startNode()
