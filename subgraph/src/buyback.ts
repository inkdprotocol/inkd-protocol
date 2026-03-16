import { BuybackExecuted } from '../generated/InkdBuyback/InkdBuyback'
import { BuybackEvent } from '../generated/schema'

export function handleBuybackExecuted(event: BuybackExecuted): void {
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const e = new BuybackEvent(id)
  e.caller    = event.params.caller
  e.usdcIn    = event.params.usdcIn
  e.inkdOut   = event.params.inkdOut
  e.timestamp = event.block.timestamp
  e.txHash    = event.transaction.hash
  e.save()
}
