import { task } from 'hardhat/config';
import { Signer } from 'ethers';
import { DRE } from '../../helpers/misc-utils';
import { verifyContract } from '../../helpers/etherscan-verification';
import { getDefaultSigner } from '../../helpers/wallet-helpers';

import { printDefinedParams, defineParams, deployContract } from '../../helpers/task-helpers';

task('deployGnosisGovernance', 'deploy AMBBridgeExecutor')
  .setAction(async ({ verify }, hre) => {
    await hre.run('set-DRE');
    const { ethers } = hre;

    let contractSigner: Signer = await (await DRE.ethers.getSigners())[0];
    console.log(DRE.network.name)

    console.log(`Signer: ${await contractSigner.getAddress()}`);
    const ContractFactory = await ethers.getContractFactory('AMBBridgeExecutor');
    const constructorInputs = ContractFactory.interface.deploy.inputs;

    // Deployment Params
    const contractParams = {
      _amb: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59',
      _controller: '0x3300f198988e4C9C63F75dF86De36421f06af8c4',
      _chainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      delay: '172800',
      gracePeriod: '259200',
      minimumDelay: '28800',
      maximumDelay: '604800',
      guardian: '0x0000000000000000000000000000000000000000',
    };

    let paramsArray: any[] = [];
    if (constructorInputs.length > 0) {
      paramsArray = await defineParams(contractParams, constructorInputs);
      printDefinedParams(constructorInputs, paramsArray);
    }

    console.log('  - Balance:', await contractSigner.getBalance());

    const contractInstance = await deployContract(paramsArray, ContractFactory, contractSigner);

    const jsonLibs = '{}';
    await verifyContract(contractInstance.address, paramsArray, jsonLibs);
  });