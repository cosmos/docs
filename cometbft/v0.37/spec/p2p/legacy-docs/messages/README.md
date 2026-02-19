---
order: 1
parent:
  title: Messages
  order: 1
---

# Messages

An implementation of the spec consists of many components. While many parts of these components are implementation specific, the p2p messages are not. In this section we will be covering all the p2p messages of components.

There are two parts to the P2P messages, the message and the channel. The channel is message specific and messages are specific to components of CometBFT. When a node connect to a peer it will tell the other node which channels are available. This notifies the peer what services the connecting node offers. You can read more on channels in [connection.md](https://github.com/cometbft/cometbft/blob/v0.37.x/spec/p2p/legacy-docs/connection.md#mconnection)

- [Block Sync](/cometbft/v0.37/spec/p2p/legacy-docs/messages/block-sync)
- [Mempool](/cometbft/v0.37/spec/p2p/legacy-docs/messages/mempool)
- [Evidence](/cometbft/v0.37/spec/p2p/legacy-docs/messages/evidence)
- [State Sync](/cometbft/v0.37/spec/p2p/legacy-docs/messages/state-sync)
- [Pex](/cometbft/v0.37/spec/p2p/legacy-docs/messages/pex)
- [Consensus](/cometbft/v0.37/spec/p2p/legacy-docs/messages/consensus)
