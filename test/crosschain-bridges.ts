import chai, { expect } from 'chai';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import {
  DRE,
  advanceBlockTo,
  advanceBlock,
  waitForTx,
  getImpersonatedSigner,
} from '../helpers/misc-utils';

import { makeSuite, setupTestEnvironment, TestEnv } from './helpers/make-suite';
import {
  createBridgeTest1,
  createBridgeTest2,
  createBridgeTest3,
  createBridgeTest4,
  createBridgeTest5,
  createBridgeTest6,
  createBridgeTest7,
  createBridgeTest8,
  createBridgeTest9,
  createBridgeTest10,
  createBridgeTest11,
  createBridgeTest12,
  createBridgeTest13,
  createBridgeTest14,
  createArbitrumBridgeTest,
} from './helpers/bridge-helpers';
import {
  expectProposalState,
  createProposal,
  triggerWhaleVotes,
  queueProposal,
} from './helpers/governance-helpers';
import { PolygonBridgeExecutor__factory } from '../typechain';

chai.use(solidity);

const proposalStates = {
  PENDING: 0,
  CANCELED: 1,
  ACTIVE: 2,
  FAILED: 3,
  SUCCEEDED: 4,
  QUEUED: 5,
  EXPIRED: 6,
  EXECUTED: 7,
};

makeSuite('Crosschain bridge tests', setupTestEnvironment, (testEnv: TestEnv) => {
  const proposals: any = [];
  const dummyAddress = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
  const dummyUint = 10203040;
  const dummyString = 'Hello';
  const overrides = { gasLimit: 5000000 };

  before(async () => {
    const { ethers } = DRE;
    const { BigNumber } = ethers;
    const {
      aaveWhale1,
      aaveWhale2,
      aaveWhale3,
      aaveGovContract,
      shortExecutor,
      customPolygonMapping,
      fxRoot,
      fxChild,
      polygonBridgeExecutor,
      inbox,
    } = testEnv;

    // Authorize new executor
    const authorizeExecutorTx = await aaveGovContract.authorizeExecutors([shortExecutor.address]);
    await expect(authorizeExecutorTx).to.emit(aaveGovContract, 'ExecutorAuthorized');

    await customPolygonMapping.register(fxRoot.address, fxChild.address);
    await waitForTx(await fxRoot.setFxChild(fxChild.address));

    // Fund Polygon Bridge
    await waitForTx(
      await polygonBridgeExecutor.connect(aaveWhale1.signer).receiveFunds({
        value: DRE.ethers.BigNumber.from('20225952773035674962'),
      })
    );

    /**
     * Create Proposal Actions 1
     * Successful Transactions on PolygonMarketUpdate
     * -> Action 1 PolygonMarketUpdate.execute(dummyInt) with value of 100 (non-delegate)
     * -> Action 2 PolygonMarketUpdate.executeWithDelegate(dummyString) with no value, as delegate
     */
    const proposal1Actions = await createBridgeTest1(dummyUint, dummyString, testEnv);
    testEnv.proposalActions.push(proposal1Actions);

    /**
     * Create Proposal Actions 2 -
     * No signature or data - will fail on execution
     */
    const proposal2Actions = await createBridgeTest2(testEnv);
    testEnv.proposalActions.push(proposal2Actions);

    /**
     * Create Proposal Actions 3 -
     * Not enough valued in delegate call
     */
    const proposal3Actions = await createBridgeTest3(dummyUint, testEnv);
    testEnv.proposalActions.push(proposal3Actions);

    /**
     * Create Proposal Actions 4 -
     * Normal Contract Call - used for cancellation
     */
    const proposal4Actions = await createBridgeTest4(dummyUint, testEnv);
    testEnv.proposalActions.push(proposal4Actions);

    /**
     * Create Proposal Actions 5 -
     * Normal Contract Call - used for expiration
     */
    const proposal5Actions = await createBridgeTest5(dummyUint, testEnv);
    testEnv.proposalActions.push(proposal5Actions);

    /**
     * Create Proposal Actions 6 -
     * targets[].length = 0
     */
    const proposal6Actions = await createBridgeTest6(testEnv);
    testEnv.proposalActions.push(proposal6Actions);

    /**
     * Create Proposal Actions 7 -
     * targets[].length != values[].length
     */
    const proposal7Actions = await createBridgeTest7(testEnv);
    testEnv.proposalActions.push(proposal7Actions);

    /**
     * Create Proposal Actions 8 -
     * duplicate actions
     */
    const proposal8Actions = await createBridgeTest8(dummyUint, testEnv);
    testEnv.proposalActions.push(proposal8Actions);

    /**
     * Create Proposal Actions 9 -
     * Update RootSender - PolygonBridgeExecutor
     */
    const proposal9Actions = await createBridgeTest9(aaveWhale2.address, testEnv);
    testEnv.proposalActions.push(proposal9Actions);

    /**
     * Create Proposal Actions 10 -
     * Update FxChild - PolygonBridgeExecutor
     */
    const proposal10Actions = await createBridgeTest10(aaveWhale2.address, testEnv);
    testEnv.proposalActions.push(proposal10Actions);

    /**
     * Create Proposal Actions 11 -
     * Update MinimumDelay - PolygonBridgeExecutor
     */
    const proposal11Actions = await createBridgeTest11(1, testEnv);
    testEnv.proposalActions.push(proposal11Actions);

    /**
     * Create Proposal Actions 12 -
     * Update MinimumDelay - PolygonBridgeExecutor
     */
    const proposal12Actions = await createBridgeTest12(90000, testEnv);
    testEnv.proposalActions.push(proposal12Actions);

    /**
     * Create Proposal Actions 13 -
     * Update MinimumDelay - PolygonBridgeExecutor
     */
    const proposal13Actions = await createBridgeTest13(2000, testEnv);
    testEnv.proposalActions.push(proposal13Actions);

    /**
     * Create Proposal Actions 14 -
     * Update MinimumDelay - PolygonBridgeExecutor
     */
    const proposal14Actions = await createBridgeTest14(61, testEnv);
    testEnv.proposalActions.push(proposal14Actions);

    /**
     * Arbitrum -- Create Proposal Actions 15
     * Successful Transactions on PolygonMarketUpdate
     * -> Action 1 PolygonMarketUpdate.execute(dummyInt) with value of 100 (non-delegate)
     * -> Action 2 PolygonMarketUpdate.executeWithDelegate(dummyString) with no value, as delegate
     */
    const proposal15Actions = await createArbitrumBridgeTest(dummyUint, dummyString, testEnv);
    testEnv.proposalActions.push(proposal15Actions);

    // Create Polygon Proposals
    for (let i = 0; i < 14; i++) {
      proposals[i] = await createProposal(
        aaveGovContract,
        aaveWhale1.signer,
        shortExecutor.address,
        [fxRoot.address],
        [BigNumber.from(0)],
        ['sendMessageToChild(address,bytes)'],
        [testEnv.proposalActions[i].encodedRootCalldata],
        [false],
        '0xf7a1f565fcd7684fba6fea5d77c5e699653e21cb6ae25fbf8c5dbc8d694c7949'
      );
      await expectProposalState(aaveGovContract, proposals[i].id, proposalStates.PENDING);
    }

    // Create Arbitrum Proposal
    proposals[14] = await createProposal(
      aaveGovContract,
      aaveWhale1.signer,
      shortExecutor.address,
      [inbox.address],
      [BigNumber.from(0)],
      ['createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)'],
      [proposal15Actions.encodedRootCalldata],
      [false],
      '0xf7a1f565fcd7684fba6fea5d77c5e699653e21cb6ae25fbf8c5dbc8d694c7949'
    );

    // Vote on Proposals
    for (let i = 0; i < 15; i++) {
      await triggerWhaleVotes(
        aaveGovContract,
        [aaveWhale1.signer, aaveWhale2.signer, aaveWhale3.signer],
        proposals[i].id,
        true
      );
      await expectProposalState(aaveGovContract, proposals[i].id, proposalStates.ACTIVE);
    }

    // Advance Block to End of Voting
    await advanceBlockTo(proposals[14].endBlock.add(1));

    // Queue Proposals
    await queueProposal(aaveGovContract, proposals[0].id);
    await queueProposal(aaveGovContract, proposals[1].id);
    await queueProposal(aaveGovContract, proposals[2].id);
    await queueProposal(aaveGovContract, proposals[3].id);
    await queueProposal(aaveGovContract, proposals[4].id);
    await queueProposal(aaveGovContract, proposals[5].id);
    await queueProposal(aaveGovContract, proposals[6].id);
    await queueProposal(aaveGovContract, proposals[7].id);
    await queueProposal(aaveGovContract, proposals[8].id);
    await queueProposal(aaveGovContract, proposals[9].id);
    await queueProposal(aaveGovContract, proposals[10].id);
    await queueProposal(aaveGovContract, proposals[11].id);
    await queueProposal(aaveGovContract, proposals[12].id);
    await queueProposal(aaveGovContract, proposals[13].id);
    const queuedProposal14 = await queueProposal(aaveGovContract, proposals[14].id);

    await expectProposalState(aaveGovContract, proposals[14].id, proposalStates.QUEUED);

    // advance to execution
    const currentBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
    const { timestamp } = currentBlock;
    const fastForwardTime = queuedProposal14.executionTime.sub(timestamp).toNumber();
    await advanceBlock(timestamp + fastForwardTime + 10);
  });

  describe('Executor - Check Deployed State', async function () {
    it('Check Grace Period', async () => {
      const { polygonBridgeExecutor } = testEnv;
      expect(await polygonBridgeExecutor.getGracePeriod()).to.be.equal(BigNumber.from(1000));
    });
    it('Check Minimum Delay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      expect(await polygonBridgeExecutor.getMinimumDelay()).to.be.equal(BigNumber.from(15));
    });
    it('Check Maximum Delay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      expect(await polygonBridgeExecutor.getMaximumDelay()).to.be.equal(BigNumber.from(500));
    });
    it('Check Delay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      expect(await polygonBridgeExecutor.getDelay()).to.be.equal(BigNumber.from(60));
    });
    it('Check isActionQueued', async () => {
      const { ethers } = DRE;
      const { polygonBridgeExecutor } = testEnv;
      const hash = ethers.utils.formatBytes32String('hello');
      expect(await polygonBridgeExecutor.isActionQueued(hash)).to.be.false;
    });
  });
  describe('Executor - Failed Deployments', async function () {
    it('Delay > Maximum Delay', async () => {
      const { shortExecutor, fxChild, aaveGovOwner } = testEnv;
      const bridgeExecutorFactory = new PolygonBridgeExecutor__factory(aaveGovOwner.signer);
      await expect(
        bridgeExecutorFactory.deploy(
          shortExecutor.address,
          fxChild.address,
          BigNumber.from(2000),
          BigNumber.from(1000),
          BigNumber.from(15),
          BigNumber.from(500),
          aaveGovOwner.address
        )
      ).to.be.revertedWith('DELAY_LONGER_THAN_MAXIMUM');
    });
    it('Delay < Minimum Delay', async () => {
      const { shortExecutor, fxChild, aaveGovOwner } = testEnv;
      const bridgeExecutorFactory = new PolygonBridgeExecutor__factory(aaveGovOwner.signer);
      await expect(
        bridgeExecutorFactory.deploy(
          shortExecutor.address,
          fxChild.address,
          BigNumber.from(10),
          BigNumber.from(1000),
          BigNumber.from(15),
          BigNumber.from(500),
          aaveGovOwner.address
        )
      ).to.be.revertedWith('DELAY_SHORTER_THAN_MINIMUM');
    });
  });
  describe('PolygonBridgeExecutor Authorization', async function () {
    it('Unauthorized Transaction - Call Bridge Receiver From Non-FxChild Address', async () => {
      const { shortExecutor, polygonBridgeExecutor } = testEnv;
      const { encodedActions } = testEnv.proposalActions[0];
      await expect(
        polygonBridgeExecutor.processMessageFromRoot(1, shortExecutor.address, encodedActions)
      ).to.be.revertedWith('UNAUTHORIZED_CHILD_ORIGIN');
    });
    it('Unauthorized Transaction - Call Root From Unauthorized Address', async () => {
      const { fxRoot, polygonBridgeExecutor } = testEnv;
      const { encodedActions } = testEnv.proposalActions[0];
      await expect(
        fxRoot.sendMessageToChild(polygonBridgeExecutor.address, encodedActions)
      ).to.be.revertedWith('FAILED_ACTION_EXECUTION_CUSTOM_MAPPING');
    });
    it('Unauthorized FxRootSender Update - Revert', async () => {
      const { polygonBridgeExecutor, aaveWhale2 } = testEnv;
      await expect(polygonBridgeExecutor.updateFxRootSender(aaveWhale2.address)).to.be.revertedWith(
        'UNAUTHORIZED_ORIGIN_ONLY_THIS'
      );
    });
    it('Unauthorized FxChild Update - Revert', async () => {
      const { polygonBridgeExecutor, aaveWhale2 } = testEnv;
      await expect(polygonBridgeExecutor.updateFxChild(aaveWhale2.address)).to.be.revertedWith(
        'UNAUTHORIZED_ORIGIN_ONLY_THIS'
      );
    });
    it('Unauthorized Delay Update - Revert', async () => {
      const { polygonBridgeExecutor, aaveWhale1 } = testEnv;
      await expect(
        polygonBridgeExecutor.connect(aaveWhale1.signer).updateDelay(1000)
      ).to.be.revertedWith('UNAUTHORIZED_ORIGIN_ONLY_THIS');
    });
    it('Unauthorized GracePeriod Update - Revert', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.updateGracePeriod(1000)).to.be.revertedWith(
        'UNAUTHORIZED_ORIGIN_ONLY_THIS'
      );
    });
    it('Unauthorized Minimum Delay Update - Revert', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.updateMinimumDelay(1)).to.be.revertedWith(
        'UNAUTHORIZED_ORIGIN_ONLY_THIS'
      );
    });
    it('Unauthorized Maximum Delay Update - Revert', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.updateMaximumDelay(100000000)).to.be.revertedWith(
        'UNAUTHORIZED_ORIGIN_ONLY_THIS'
      );
    });
  });
  describe('ArbitrumBridgeExecutor Authorization', async function () {
    it('Unauthorized Transaction - Call Bridge Receiver From Non-FxChild Address', async () => {
      const { arbitrumBridgeExecutor } = testEnv;
      const {
        targets,
        values,
        signatures,
        calldatas,
        withDelegatecalls,
      } = testEnv.proposalActions[0];
      await expect(
        arbitrumBridgeExecutor.queue(targets, values, signatures, calldatas, withDelegatecalls)
      ).to.be.revertedWith('UNAUTHORIZED_EXECUTOR');
    });
  });
  describe('Executor - Validate Delay Logic', async function () {
    it('Delay > Maximum Delay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      const polygonBridgeExecutorSigner = await getImpersonatedSigner(
        polygonBridgeExecutor.address
      );
      await expect(
        polygonBridgeExecutor.connect(polygonBridgeExecutorSigner).updateDelay(100000000)
      ).to.be.revertedWith('DELAY_LONGER_THAN_MAXIMUM');
    });
    it('Delay < Minimum Delay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      const polygonBridgeExecutorSigner = await getImpersonatedSigner(
        polygonBridgeExecutor.address
      );
      await expect(
        polygonBridgeExecutor.connect(polygonBridgeExecutorSigner).updateDelay(1)
      ).to.be.revertedWith('DELAY_SHORTER_THAN_MINIMUM');
    });
  });
  describe('Queue - PolgygonBridgeExecutor through Ethereum Aave Governance', async function () {
    it('Execute Proposal 1 - successfully queue transaction - expected successful actions', async () => {
      const { ethers } = DRE;

      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        shortExecutor,
        polygonBridgeExecutor,
      } = testEnv;

      const {
        targets,
        values,
        signatures,
        calldatas,
        withDelegatecalls,
        encodedActions,
      } = testEnv.proposalActions[0];

      const encodedSyncData = ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'bytes'],
        [shortExecutor.address, polygonBridgeExecutor.address, encodedActions]
      );

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await await ethers.provider.getBlock(blockNumber);
      const blocktime = block.timestamp;
      const expectedExecutionTime = blocktime + 61;

      testEnv.proposalActions[0].executionTime = expectedExecutionTime;

      expect(await aaveGovContract.execute(proposals[0].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .withArgs(1, fxChild.address, encodedSyncData)
        .to.emit(fxChild, 'NewFxMessage')
        .withArgs(shortExecutor.address, polygonBridgeExecutor.address, encodedActions)
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .withArgs(
          0,
          targets,
          values,
          signatures,
          calldatas,
          withDelegatecalls,
          expectedExecutionTime
        )
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 2 - successfully queue transaction - actions fail on execution (failed transaction)', async () => {
      const { ethers } = DRE;
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      const {
        targets,
        values,
        signatures,
        calldatas,
        withDelegatecalls,
      } = testEnv.proposalActions[1];

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await await ethers.provider.getBlock(blockNumber);
      const blocktime = block.timestamp;
      const expectedExecutionTime = blocktime + 61;
      testEnv.proposalActions[1].executionTime = expectedExecutionTime;

      await expect(aaveGovContract.execute(proposals[1].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .withArgs(
          1,
          targets,
          values,
          signatures,
          calldatas,
          withDelegatecalls,
          expectedExecutionTime
        )
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 3 - successfully queue transaction - actions fail on execution (not enough value)', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[2].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 4 - successfully queue transaction - actions used for cancellation', async () => {
      const { ethers } = DRE;
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await await ethers.provider.getBlock(blockNumber);
      const blocktime = block.timestamp;

      const expectedExecutionTime = blocktime + 61;
      testEnv.proposalActions[3].executionTime = expectedExecutionTime;
      await expect(aaveGovContract.execute(proposals[3].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 5 - successfully queue transaction - actions used for expiration', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[4].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 6 - polygon gov error - no targets in polygon actions', async () => {
      const { aaveGovContract } = testEnv;
      await expect(aaveGovContract.execute(proposals[5].id)).to.be.revertedWith(
        'FAILED_ACTION_EXECUTION'
      );
    });
    it('Execute Proposal 7 - polygon gov error - targets[].length < values[].length in polygon actions', async () => {
      const { aaveGovContract } = testEnv;
      await expect(aaveGovContract.execute(proposals[6].id)).to.be.revertedWith(
        'FAILED_ACTION_EXECUTION'
      );
    });
    it('Execute Proposal 8 - polygon gov error - duplicate polygon actions', async () => {
      const { aaveGovContract } = testEnv;
      await expect(aaveGovContract.execute(proposals[7].id)).to.be.revertedWith(
        'FAILED_ACTION_EXECUTION'
      );
    });
    it('Execute Proposal 9 - successfully queue transaction - fx root sender update', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[8].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 10 - successfully queue transaction - fx child update', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[9].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 11 - successfully queue transaction - min delay update', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[10].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 12 - successfully queue transaction - max delay update', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[11].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 13 - successfully queue transaction - gracePeriod update', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[12].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
    it('Execute Proposal 14 - successfully queue transaction - delay update', async () => {
      const {
        aaveGovContract,
        customPolygonMapping,
        fxChild,
        polygonBridgeExecutor,
        shortExecutor,
      } = testEnv;
      await expect(aaveGovContract.execute(proposals[13].id, overrides))
        .to.emit(customPolygonMapping, 'StateSynced')
        .to.emit(fxChild, 'NewFxMessage')
        .to.emit(polygonBridgeExecutor, 'ActionsSetQueued')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
    });
  });
  describe('Queue - ArbitrumBridgeExecutor through Ethereum Aave Governance', async function () {
    it('Execute Proposal 14 - successfully queue Arbitrum transaction - duplicate polygon actions', async () => {
      const { ethers } = DRE;
      const { aaveGovContract, inbox, shortExecutor, arbitrumBridgeExecutor, bridge } = testEnv;
      const {
        targets,
        values,
        signatures,
        calldatas,
        withDelegatecalls,
      } = testEnv.proposalActions[14];

      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await await ethers.provider.getBlock(blockNumber);
      const blocktime = block.timestamp;
      const expectedExecutionTime = blocktime + 61;

      testEnv.proposalActions[14].executionTime = expectedExecutionTime;
      const tx = await aaveGovContract.execute(proposals[14].id, overrides);
      const txReceipt = await tx.wait();
      expect(tx)
        .to.emit(bridge, 'MessageDelivered')
        .to.emit(inbox, 'InboxMessageDelivered')
        .to.emit(shortExecutor, 'ExecutedAction')
        .to.emit(aaveGovContract, 'ProposalExecuted');
      const parsedLog = arbitrumBridgeExecutor.interface.parseLog(txReceipt.logs[2]);
      expect(parsedLog.args.targets).to.be.eql(targets);
      expect(parsedLog.args[2]).to.be.eql(values);
      expect(parsedLog.args.signatures).to.be.eql(signatures);
      expect(parsedLog.args.calldatas).to.be.eql(calldatas);
      expect(parsedLog.args.withDelegatecalls).to.be.eql(withDelegatecalls);
    });
  });
  describe('Confirm ActionSet State - Bridge Executor', async function () {
    it('Confirm ActionsSet 0 State', async () => {
      const { polygonBridgeExecutor } = testEnv;
      const {
        targets,
        values,
        signatures,
        calldatas,
        withDelegatecalls,
        executionTime,
      } = testEnv.proposalActions[0];

      const actionsSet = await polygonBridgeExecutor.getActionsSetById(0);
      expect(actionsSet.targets).to.be.eql(targets);
      // work around - actionsSet[1] == actionsSet.values
      expect(actionsSet[1]).to.be.eql(values);
      expect(actionsSet.signatures).to.be.eql(signatures);
      expect(actionsSet.calldatas).to.be.eql(calldatas);
      expect(actionsSet.withDelegatecalls).to.be.eql(withDelegatecalls);
      expect(actionsSet.executionTime).to.be.equal(executionTime);
      expect(actionsSet.executed).to.be.false;
      expect(actionsSet.canceled).to.be.false;
    });
    it('Confirm ActionsSet 1 State', async () => {
      const { polygonBridgeExecutor } = testEnv;
      const {
        targets,
        values,
        signatures,
        calldatas,
        withDelegatecalls,
        executionTime,
      } = testEnv.proposalActions[1];

      const actionsSet = await polygonBridgeExecutor.getActionsSetById(1);

      expect(actionsSet.targets).to.be.eql(targets);
      // work around - actionsSet[1] == actionsSet.values
      expect(actionsSet[1]).to.be.eql(values);
      expect(actionsSet.signatures).to.be.eql(signatures);
      expect(actionsSet.calldatas).to.be.eql(calldatas);
      expect(actionsSet.withDelegatecalls).to.be.eql(withDelegatecalls);
      expect(actionsSet.executionTime).to.be.equal(executionTime);
      expect(actionsSet.executed).to.be.false;
      expect(actionsSet.canceled).to.be.false;
    });
  });
  describe('Execute Action Sets - Aave Polygon Governance', async function () {
    it('Get State of Actions 0 - Actions Queued', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(await polygonBridgeExecutor.getCurrentState(0)).to.be.eq(0);
    });
    it('Execute Action Set 0 - polygon gov error - timelock not finished', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(0)).to.revertedWith('TIMELOCK_NOT_FINISHED');
    });
    it('Execute Action Set 0 - execution successful', async () => {
      const { ethers } = DRE;
      const { polygonBridgeExecutor, polygonMarketUpdate, aaveGovOwner } = testEnv;
      const { values } = testEnv.proposalActions[0];
      const blocktime = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber()))
        .timestamp;
      await advanceBlock(blocktime + 100);
      const tx = await polygonBridgeExecutor.execute(0);
      await expect(tx)
        .to.emit(polygonMarketUpdate, 'UpdateExecuted')
        .withArgs(1, dummyUint, dummyAddress, values[0])
        .to.emit(polygonBridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, aaveGovOwner.address);
      const transactionReceipt = await tx.wait();
      const delegateLog = polygonMarketUpdate.interface.parseLog(transactionReceipt.logs[1]);
      expect(ethers.utils.parseBytes32String(delegateLog.args.testBytes)).to.equal(dummyString);
      expect(delegateLog.args.sender).to.equal(aaveGovOwner.address);
    });
    it('Get State of Action Set 0 - Actions Executed', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(await polygonBridgeExecutor.getCurrentState(0)).to.be.eq(1);
    });
    it('Execute Action Set 100 - polygon gov error - invalid actions id', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(100)).to.revertedWith('INVALID_ACTION_ID');
    });
    it('Execute Action Set 1 - polygon gov error - failing action', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(1)).to.revertedWith('FAILED_ACTION_EXECUTION');
    });
    it('Execute Action Set 2 - polygon gov error - not enough msg value', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(2)).to.revertedWith('NOT_ENOUGH_MSG_VALUE');
    });
    it('Execute Action Set 5 - updateFxRootSender', async () => {
      const { polygonBridgeExecutor, shortExecutor, aaveWhale2 } = testEnv;
      await expect(polygonBridgeExecutor.execute(5))
        .to.emit(polygonBridgeExecutor, 'FxRootSenderUpdate')
        .withArgs(
          DRE.ethers.utils.getAddress(shortExecutor.address),
          DRE.ethers.utils.getAddress(aaveWhale2.address)
        );
    });
    it('Execute Action Set 6 - updateFxChild', async () => {
      const { polygonBridgeExecutor, fxChild, aaveWhale2 } = testEnv;
      await expect(polygonBridgeExecutor.execute(6))
        .to.emit(polygonBridgeExecutor, 'FxChildUpdate')
        .withArgs(
          DRE.ethers.utils.getAddress(fxChild.address),
          DRE.ethers.utils.getAddress(aaveWhale2.address)
        );
    });
    it('Execute Action Set 7 - updateMinDelay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(7))
        .to.emit(polygonBridgeExecutor, 'MinimumDelayUpdate')
        .withArgs(15, 1);
    });
    it('Execute Action Set 8 - updateMaxDelay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(8))
        .to.emit(polygonBridgeExecutor, 'MaximumDelayUpdate')
        .withArgs(500, 90000);
    });
    it('Execute Action Set 9 - updateGracePeriod', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(9))
        .to.emit(polygonBridgeExecutor, 'GracePeriodUpdate')
        .withArgs(1000, 2000);
    });
    it('Execute Action Set 10 - updateDelay', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.execute(10))
        .to.emit(polygonBridgeExecutor, 'DelayUpdate')
        .withArgs(60, 61);
    });
  });
  describe('Cancel Actions - Aave Polygon Governance', async function () {
    it('Get State of Action Set 2 - Action Set Queued', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(await polygonBridgeExecutor.getCurrentState(3)).to.be.eq(0);
    });
    it('Cancel Action Set 2 - polygon gov error - only guardian', async () => {
      const { polygonBridgeExecutor, aaveWhale1 } = testEnv;
      await expect(polygonBridgeExecutor.connect(aaveWhale1.signer).cancel(3)).to.be.revertedWith(
        'ONLY_BY_GUARDIAN'
      );
    });
    it('Cancel Action Set 0 - polygon gov error - only before executed', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(polygonBridgeExecutor.cancel(0)).to.be.revertedWith('ONLY_BEFORE_EXECUTED');
    });
    it('Cancel Action Set 2 - successful cancellation', async () => {
      const { polygonBridgeExecutor, aaveGovOwner } = testEnv;
      await expect(polygonBridgeExecutor.connect(aaveGovOwner.signer).cancel(3))
        .to.emit(polygonBridgeExecutor, 'ActionsSetCanceled')
        .withArgs(3);
    });
    it('Get State of Action Set 2 - Actions Canceled', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(await polygonBridgeExecutor.getCurrentState(3)).to.be.eq(2);
    });
  });
  describe('Expired Actions - Aave Polygon Governance', async function () {
    it('Get State of Action Set 3 - Actions Queued', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(await polygonBridgeExecutor.getCurrentState(4)).to.be.eq(0);
    });
    it('Execute Actions 3 - polygon gov error - expired action', async () => {
      const { ethers } = DRE;
      const { polygonBridgeExecutor } = testEnv;
      const blocktime = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber()))
        .timestamp;
      await advanceBlock(blocktime + 100000);
      await expect(polygonBridgeExecutor.execute(4)).to.revertedWith('ONLY_QUEUED_ACTIONS');
    });
    it('Get State of Actions 3 - Actions Expired', async () => {
      const { polygonBridgeExecutor } = testEnv;
      await expect(await polygonBridgeExecutor.getCurrentState(4)).to.be.eq(3);
    });
  });
});