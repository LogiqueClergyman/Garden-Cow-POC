# Primary Prompt:

I need to build a cross-chain swap application using Garden Finance and Cowswap. The app needs to support both Bitcoin (via UniSat) and EVM (via MetaMask) on Testnet to perform evm to evm and btc to evm swaps through Garden, and then use cowswap to convert it into any cow specific token (ex: cow token). When a user, lets say arrives from any supported evm chain or bitcoin, deposits their source asset into garden, garden would swap it into a common asset on both protocol (here we will first convert it to eth sepolia then metmask wrap it into weth, as its the only common testnet asset on both protocols) and then cowswap swaps it into cow token for the user. Thus this flow would allow the garden supported assets to be converted into cow supported assets.

The end product would have a UI that is modern, polished and structured, supports dual wallet connection (Unisat for BTC  and Metamask for EVM), have clean asset selectors with chain badges and icons (fetch the chains and assets dynamically from the api itself and do not hardocde them) and must fully handle the quoting and order flow, including automatic network switching to ensure the wallet is on the correct chain and using the correct chainId before initiating the order. It must show the combined quote in case user is swapping to cow token, other wise just the garden quote if its an intra-garden swap. Make sure the ui shows human readable values, but passes the values in the required formats to the wallets and for other logics. Since we are working on testnet and it oftentimes has fluctuating fees, do override the default metamask max fee to 2x. Also since bitcoin block confirmations and cowswap order fulfillment on testnet can take hours, ensure we don't have timeout limits for checking order statuses.

Go through the garden docs at docs.garden.finance and specifically through: https://docs.garden.finance/api-reference/quickstart#from-bitcoin and  
https://docs.garden.finance/api-reference/quickstart#from-evm for quickstart guides, and https://docs.garden.finance/api-reference for the api references. Use this this test key: f242ea49332293424c96c562a6ef575a819908c878134dcb4fce424dc84ec796. Since this is just a small demo dapp, we will just use the api references (https://docs.garden.finance/api-reference)  and not the sdk. Go through the api references to understand all the apis available.
Here are the cowswap docs: https://docs.cow.fi/cow-protocol/reference/sdks/cow-sdk and https://docs.cow.fi/cow-protocol/integrate/sdk for a quickstart.

### _The prompts below could vary very-slightly based on the errors generated. They are rectified immediately and the app can easily be done within the next 2-3 prompts_

## Prompt 2:

These are the few errors caught:

This occured when initiating the swap:

```text
Initiate failed: maxFeePerGas cannot be less than maxPriorityFeePerGas (The total must be the larger of the two) (tx type=2 hash=not available (unsigned) nonce=35 value=0 signed=false hf=prague maxFeePerGas=40020000 maxPriorityFeePerGas=3000000000)
```

This occured at weth wrapping:

```text
WETH wrap failed: missing revert data (action="estimateGas", data=null, reason=null, transaction={ "data": "0xd0e30db0", "from": "0xDc7023c327d4362BfeBE973bF9237E7Db80f734B", "to": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" }, invocation=null, revert=null, code=CALL_EXCEPTION, version=6.16.0)
```

This occured while Order signing failed:

```text
Keyring Controller signTypedMessage: ParserError: An unexpected error occurred: Expected a bytes-like value, got "{"version":"1.1.0","appCode":"garden-cowswap-bridge","metadata":{}}".
```

## Prompt 3:

error while creating cow order:

```json
{
    "errorType": "InvalidAppData",
    "description": "Unknown pre-image for app data hash 0x877378647a4297bfc765a1fcb7710d3a224060dc71cbaae4305b903efe706c60"
}
```
```text
CowSwap order submission failed: invalid type: integer `0`, expected struct Root at line 1 column 1
```