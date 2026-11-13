## 2026-11-13

- Added "When a chain shuts down" (hub/latest/delegators/chain-wind-down, synced to next) under Delegate and stake: what users, validators and chain teams do with IBC tokens before a chain halts for good, from the forum discussion in topic 17510
- Tested the page on a local three-chain devnet (gaia v29.0.1, ibc-go v10.7.0, Hermes v1.13.1): hop-by-hop return, receive_enabled error acks, halt with an upgrade plan and client expiry all matched. Added the verified banner and two corrections from the halt test: a packet sent in the last block before the halt can't be delivered, and Hermes did not relay pending packets after the halt
