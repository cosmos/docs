## 2026-11-13

- Added "When a chain shuts down" (hub/latest/delegators/chain-wind-down, synced to next) under Delegate and stake: what users, validators and chain teams do with IBC tokens before a chain halts for good, from the forum discussion in topic 17510
- Tested the page on a local three-chain devnet (gaia v29.0.1, ibc-go v10.7.0, Hermes v1.13.1): hop-by-hop return, receive_enabled error acks, halt with an upgrade plan and client expiry all matched. Added the verified banner and two corrections from the halt test: a packet sent in the last block before the halt can't be delivered, and Hermes did not relay pending packets after the halt
- Tested the ante-handler and middleware options on a local gaia v29.0.1 test build: both behaved as the page says, no change
- Added "Leave outbound transfers on until returns are done" from review in topic 17510 (post 9): transfer send_enabled off strands other chains' tokens, bank send for one denom stops only that token, and governance timing versus the halt height. Confirmed on the devnet with ibc-go v10.7.0
