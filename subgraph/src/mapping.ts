import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts'
import { PriceUpdate, OwnershipTransfer } from '../generated/schema'
import { PriceUpdated, OwnershipTransferred } from '../generated/PriceFeed/PriceFeed'

export function handlePriceUpdated(event: PriceUpdated): void {
  let id = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let priceUpdate = new PriceUpdate(id)
  
  priceUpdate.asset = event.params.asset
  priceUpdate.price = event.params.price
  priceUpdate.timestamp = event.params.timestamp
  priceUpdate.transactionHash = event.transaction.hash
  
  priceUpdate.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let id = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let ownershipTransfer = new OwnershipTransfer(id)
  
  ownershipTransfer.previousOwner = event.params.previousOwner as Bytes
  ownershipTransfer.newOwner = event.params.newOwner as Bytes
  ownershipTransfer.timestamp = event.block.timestamp
  ownershipTransfer.transactionHash = event.transaction.hash
  
  ownershipTransfer.save()
} 