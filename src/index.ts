import { getContractAddressesForChainOrThrow } from '@0x/contract-addresses';
import { artifacts, DummyERC20TokenContract } from '@0x/contracts-erc20';
import { constants, OrderFactory } from '@0x/contracts-test-utils';
import { assetDataUtils } from '@0x/order-utils';
import { PrivateKeyWalletSubprovider, RPCSubprovider, SupportedProvider, Web3ProviderEngine } from '@0x/subproviders';
import { BigNumber, logUtils, providerUtils } from '@0x/utils';
import * as ethUtil from 'ethereumjs-util';
import * as yargs from 'yargs';

// TODO(jalextowle): Create config file
const args = yargs
    .option('rpc-url', {
        describe: 'Endpoint where backing Ethereum JSON RPC interface is available',
        type: 'string',
        demandOption: false,
        default: 'http://localhost:8545',
    })
    .option('from', {
        describe: 'Ethereum address from which to deploy the contracts',
        type: 'string',
        demandOption: true,
    })
    .option('pk', {
        describe: 'Private key for the `from` address',
        type: 'string',
    })
    .option('maker-token', {
        describe: 'Address for the maker token address',
        type: 'string',
    })
    .option('taker-token', {
        describe: 'Address for the taker token address',
        type: 'string',
    })
    .example(
        '$0 --rpc-url http://localhost:8545 --from 0x5409ed021d9299bf6814279a6a1411a7e866a631 --pk 0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d',
        'Full usage example',
    ).argv;

(async () => {
    const rpcSubprovider = new RPCSubprovider(args['rpc-url']);
    const provider = new Web3ProviderEngine();

    if (args.pk !== undefined && args.pk !== '') {
        const pkSubprovider = new PrivateKeyWalletSubprovider(args.pk as string);
        provider.addProvider(pkSubprovider);
    }

    provider.addProvider(rpcSubprovider);
    providerUtils.startProviderEngine(provider);
    const normalizedFromAddress = (args.from as string).toLowerCase();
    const txDefaults = {
        from: normalizedFromAddress,
    };

    const chainId = await providerUtils.getChainIdAsync(provider);
    const exchangeAddress = getContractAddressesForChainOrThrow(chainId).exchange;

    // Deploy a couple of dummy tokens
    // TODO(jalextowle): Cache these in a file.
    const makerToken = args['maker-token']
        ? new DummyERC20TokenContract(args['maker-token'], provider)
        : await deployDummyTokenAsync('MAKER_TOKEN', 'MT', args.from, provider);
    const takerToken = args['taker-token']
        ? new DummyERC20TokenContract(args['taker-token'], provider)
        : await deployDummyTokenAsync('TAKER_TOKEN', 'TT', args.from, provider);

    const orderFactory = new OrderFactory(ethUtil.toBuffer(`0x${args.pk!}`), {
        chainId,
        exchangeAddress,
        makerAddress: args.from,
        makerAssetAmount: new BigNumber(1),
        makerAssetData: assetDataUtils.encodeERC20AssetData(makerToken.address),
        takerAssetAmount: new BigNumber(1),
        takerAssetData: assetDataUtils.encodeERC20AssetData(takerToken.address),
        makerFee: constants.ZERO_AMOUNT,
        makerFeeAssetData: constants.NULL_BYTES,
        takerFee: constants.ZERO_AMOUNT,
        takerFeeAssetData: constants.NULL_BYTES,
        feeRecipientAddress: constants.NULL_ADDRESS,
    });

    // TODO(jalextowle): Cache these orders
    logUtils.log(await orderFactory.newSignedOrderAsync({}));
    process.exit(0);
})().catch(err => {
    logUtils.log(err);
    process.exit(1);
});

async function deployDummyTokenAsync(
    tokenName: string,
    tokenSymbol: string,
    fromAddress: string,
    provider: SupportedProvider,
): Promise<DummyERC20TokenContract> {
    return DummyERC20TokenContract.deployFrom0xArtifactAsync(
        artifacts.DummyERC20Token,
        provider,
        {
            from: args.from,
        },
        artifacts,
        'TAKER_TOKEN',
        'TT',
        new BigNumber(18),
        new BigNumber('1e18'),
    );
}
