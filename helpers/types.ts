export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork =
  | eEthereumNetwork
  | ePolygonNetwork
  | eGnosisChainNetwork
  | eArbitrumNetwork
  | eOptimismNetwork;

export enum eEthereumNetwork {
  kovan = 'kovan',
  ropsten = 'ropsten',
  rinkeby = 'rinkeby',
  goerli = 'goerli',
  main = 'main',
  coverage = 'coverage',
  hardhat = 'hardhat',
  tenderlyMain = 'tenderlyMain',
}

export enum ePolygonNetwork {
  matic = 'matic',
  mumbai = 'mumbai',
}

export enum eGnosisChainNetwork {
  gnosis = 'gnosis',
  chiado = 'chiado'
}

export enum eArbitrumNetwork {
  arbitrum = 'arbitrum',
  arbitrumRinkeby = 'arbitrum-rinkeby',
  arbitrumGoerli = 'arbitrum-goerli'
}

export enum eOptimismNetwork {
  main = 'optimism',
  testnet = 'optimism-testnet',
}

export enum EthereumNetworkNames {
  kovan = 'kovan',
  ropsten = 'ropsten',
  rinkeby = 'rinkeby',
  goerli = 'goerli',
  main = 'main',
  matic = 'matic',
  mumbai = 'mumbai',
  gnosis = 'gnosis',
}

export type tEthereumAddress = string;

export type iParamsPerNetwork<T> =
  | iEthereumParamsPerNetwork<T>
  | iPolygonParamsPerNetwork<T>
  | iGnosisChainParamsPerNetwork<T>
  | iArbitrumParamsPerNetwork<T>
  | iOptimismParamsPerNetwork<T>;

export interface iParamsPerNetworkAll<T>
  extends iEthereumParamsPerNetwork<T>,
    iPolygonParamsPerNetwork<T>,
    iGnosisChainParamsPerNetwork<T> {}

export interface iEthereumParamsPerNetwork<eNetwork> {
  [eEthereumNetwork.coverage]: eNetwork;
  [eEthereumNetwork.kovan]: eNetwork;
  [eEthereumNetwork.ropsten]: eNetwork;
  [eEthereumNetwork.rinkeby]: eNetwork;
  [eEthereumNetwork.goerli]: eNetwork;
  [eEthereumNetwork.main]: eNetwork;
  [eEthereumNetwork.hardhat]: eNetwork;
  [eEthereumNetwork.tenderlyMain]: eNetwork;
}

export interface iPolygonParamsPerNetwork<T> {
  [ePolygonNetwork.matic]: T;
  [ePolygonNetwork.mumbai]: T;
}

export interface iGnosisChainParamsPerNetwork<T> {
  [eGnosisChainNetwork.gnosis]: T;
  [eGnosisChainNetwork.chiado]: T;
}

export interface iArbitrumParamsPerNetwork<T> {
  [eArbitrumNetwork.arbitrum]: T;
  [eArbitrumNetwork.arbitrumRinkeby]: T;
  [eArbitrumNetwork.arbitrumGoerli]: T;
}

export interface iOptimismParamsPerNetwork<T> {
  [eOptimismNetwork.main]: T;
  [eOptimismNetwork.testnet]: T;
}

export interface ObjectString {
  [key: string]: string;
}
