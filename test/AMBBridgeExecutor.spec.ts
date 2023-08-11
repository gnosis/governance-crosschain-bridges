import hardhat, { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AMBBridgeExecutor, AMBBridgeExecutor__factory, MockAMB, MockAMB__factory } from '../typechain';
import {
  evmSnapshot,
  evmRevert,
  advanceBlocks,
  setBlocktime,
  timeLatest,
} from '../helpers/misc-utils';
import { ONE_ADDRESS, ZERO_ADDRESS } from '../helpers/constants';
import { ExecutorErrors } from './helpers/executor-helpers';
import { BigNumber } from 'ethers';

chai.use(solidity);

let user: SignerWithAddress;
let AMBForeignChain: MockAMB;
let HomeChainController: SignerWithAddress;
let guardian: SignerWithAddress;
let users: SignerWithAddress[];

let bridgeExecutor: AMBBridgeExecutor;

const DELAY = 50;
const MAXIMUM_DELAY = 100;
const MINIMUM_DELAY = 1;
const GRACE_PERIOD = 1000;
const FortyTwo =
  "0x000000000000000000000000000000000000000000000000000000000000002a";

const encodeSimpleActionsSet = (target: string, fn: string, params: any[]) => {
  const paramTypes = fn.split('(')[1].split(')')[0].split(',');
  const data = [
    [target],
    [BigNumber.from(0)],
    [fn],
    [ethers.utils.defaultAbiCoder.encode(paramTypes, [...params])],
    [false],
  ];
  const encodedData = ethers.utils.defaultAbiCoder.encode(
    ['address[]', 'uint256[]', 'string[]', 'bytes[]', 'bool[]'],
    data
  );

  return { data, encodedData };
};

describe('AMBBridgeExecutor', async function () {
  let snapId;

  before(async () => {
    await hardhat.run('set-DRE');
    [user, HomeChainController, guardian, ...users] = await ethers.getSigners();

    AMBForeignChain = await new MockAMB__factory(user).deploy();
    await AMBForeignChain.setMessageSourceChainId(FortyTwo);
    await AMBForeignChain.setMessageSender(HomeChainController.address);

    bridgeExecutor = await new AMBBridgeExecutor__factory(user).deploy(
      AMBForeignChain.address,
      HomeChainController.address,
      FortyTwo,
      DELAY,
      GRACE_PERIOD,
      MINIMUM_DELAY,
      MAXIMUM_DELAY,
      guardian.address
    );
  });

  beforeEach(async () => {
    snapId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(snapId);
  });

  it('Check initial parameters', async () => {
    // Executor parameters
    expect(await bridgeExecutor.getDelay()).to.be.equal(DELAY);
    expect(await bridgeExecutor.getGracePeriod()).to.be.equal(GRACE_PERIOD);
    expect(await bridgeExecutor.getMinimumDelay()).to.be.equal(MINIMUM_DELAY);
    expect(await bridgeExecutor.getMaximumDelay()).to.be.equal(MAXIMUM_DELAY);
    expect(await bridgeExecutor.getGuardian()).to.be.equal(guardian.address);

    // ActionsSet
    expect(await bridgeExecutor.getActionsSetCount()).to.be.equal(0);
    await expect(bridgeExecutor.getCurrentState(0)).to.be.revertedWith(
      ExecutorErrors.InvalidActionsSetId
    );

    // AMB parameters
    expect(await bridgeExecutor.amb()).to.be.equal(AMBForeignChain.address);
    expect(await bridgeExecutor.controller()).to.be.equal(HomeChainController.address);
  });

  context('AMB Foreign contract queue actions sets', () => {
    it('AMB Foreign contract tries to queue actions set with wrong amb sender (revert expected)', async () => {
      await expect(
        bridgeExecutor.connect(users[0]).processMessageFromAMB('0x')
      ).to.be.revertedWith(ExecutorErrors.UnauthorizedAMB);
    });

    it('AMB Foreign contract tries to queue actions set with wrong chainID (revert expected)', async () => {
      let wrongId = "0x000000000000000000000000000000000000000000000000000000000000002a";
      await AMBForeignChain.setMessageSourceChainId(wrongId);
      await expect(
        bridgeExecutor.connect(AMBForeignChain.address).processMessageFromAMB('0x')
      ).to.be.revertedWith(ExecutorErrors.UnauthorizedChainId);
    });

    it('AMB Foreign contract tries to queue actions set with wrong controller (revert expected)', async () => {
      await AMBForeignChain.setMessageSender(users[0].address);
      await expect(
        bridgeExecutor.connect(AMBForeignChain.address).processMessageFromAMB('0x')
      ).to.be.revertedWith(ExecutorErrors.UnauthorizedController);
    });

    it('AMB Foreign contract tries to queue an empty actions set (revert expected)', async () => {
      await expect(
        bridgeExecutor.connect(AMBForeignChain.address).processMessageFromAMB('0x')
      ).to.be.reverted;
    });

    it('AMB Foreign contract tries to queue an actions set with 0 targets (revert expected)', async () => {
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'string[]', 'bytes[]', 'bool[]'],
        [[], [0], ['mock()'], ['0x'], [false]]
      );
      await expect(
        bridgeExecutor
          .connect(AMBForeignChain.address)
          .processMessageFromAMB(encodedData)
      ).to.be.revertedWith(ExecutorErrors.EmptyTargets);
    });

    it('AMB Foreign contract tries to queue an actions set with inconsistent params length (revert expected)', async () => {
      const wrongDatas = [
        [[ZERO_ADDRESS], [], ['mock()'], ['0x'], [false]],
        [[ZERO_ADDRESS], [0], [], ['0x'], [false]],
        [[ZERO_ADDRESS], [0], ['mock()'], [], [false]],
        [[ZERO_ADDRESS], [0], ['mock()'], ['0x'], []],
      ];
      for (const wrongData of wrongDatas) {
        await expect(
          bridgeExecutor
            .connect(AMBForeignChain.address)
            .processMessageFromAMB(
              ethers.utils.defaultAbiCoder.encode(
                ['address[]', 'uint256[]', 'string[]', 'bytes[]', 'bool[]'],
                wrongData
              )
            )
        ).to.be.revertedWith(ExecutorErrors.InconsistentParamsLength);
      }
    });

    it('AMB Foreign contract tries to queue a duplicated actions set (revert expected)', async () => {
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'string[]', 'bytes[]', 'bool[]'],
        [
          [ZERO_ADDRESS, ZERO_ADDRESS],
          [0, 0],
          ['mock()', 'mock()'],
          ['0x', '0x'],
          [false, false],
        ]
      );
      await expect(
        bridgeExecutor
          .connect(AMBForeignChain.address)
          .processMessageFromAMB(encodedData)
      ).to.be.revertedWith(ExecutorErrors.DuplicateAction);
    });
  });

  context('Update parameters', () => {
    it('Tries to update any executor parameter without being itself', async () => {
      const randomAddress = ONE_ADDRESS;
      const randomUint = 123456;
      const calls = [
        { fn: 'updateGuardian', params: [randomAddress] },
        { fn: 'updateDelay', params: [randomUint] },
        { fn: 'updateGracePeriod', params: [randomUint] },
        { fn: 'updateMinimumDelay', params: [randomUint] },
        { fn: 'updateMaximumDelay', params: [randomUint] },
      ];
      for (const call of calls) {
        await expect(bridgeExecutor[call.fn](...call.params)).to.be.revertedWith(
          ExecutorErrors.OnlyCallableByThis
        );
      }
    });

    it('Update guardian', async () => {
      expect(await bridgeExecutor.getGuardian()).to.be.equal(guardian.address);

      const NEW_GUARDIAN_ADDRESS = ZERO_ADDRESS;
      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'updateGuardian(address)',
        [NEW_GUARDIAN_ADDRESS]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'GuardianUpdate')
        .withArgs(guardian.address, NEW_GUARDIAN_ADDRESS);

      expect(await bridgeExecutor.getGuardian()).to.be.equal(NEW_GUARDIAN_ADDRESS);
    });

    it('Update delay', async () => {
      expect(await bridgeExecutor.getDelay()).to.be.equal(DELAY);

      const NEW_DELAY = 10;

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'updateDelay(uint256)',
        [NEW_DELAY]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'DelayUpdate')
        .withArgs(DELAY, NEW_DELAY);

      expect(await bridgeExecutor.getDelay()).to.be.equal(NEW_DELAY);
    });

    it('Update grace period', async () => {
      expect(await bridgeExecutor.getGracePeriod()).to.be.equal(GRACE_PERIOD);

      const NEW_GRACE_PERIOD = 1200;

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'updateGracePeriod(uint256)',
        [NEW_GRACE_PERIOD]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'GracePeriodUpdate')
        .withArgs(GRACE_PERIOD, NEW_GRACE_PERIOD);

      expect(await bridgeExecutor.getGracePeriod()).to.be.equal(NEW_GRACE_PERIOD);
    });

    it('Update minimum delay', async () => {
      expect(await bridgeExecutor.getMinimumDelay()).to.be.equal(MINIMUM_DELAY);

      const NEW_MINIMUM_DELAY = 10;

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'updateMinimumDelay(uint256)',
        [NEW_MINIMUM_DELAY]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'MinimumDelayUpdate')
        .withArgs(MINIMUM_DELAY, NEW_MINIMUM_DELAY);

      expect(await bridgeExecutor.getMinimumDelay()).to.be.equal(NEW_MINIMUM_DELAY);
    });

    it('Update maximum delay', async () => {
      expect(await bridgeExecutor.getMaximumDelay()).to.be.equal(MAXIMUM_DELAY);

      const NEW_MAXIMUM_DELAY = 60;

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'updateMaximumDelay(uint256)',
        [NEW_MAXIMUM_DELAY]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'MaximumDelayUpdate')
        .withArgs(MAXIMUM_DELAY, NEW_MAXIMUM_DELAY);

      expect(await bridgeExecutor.getMaximumDelay()).to.be.equal(NEW_MAXIMUM_DELAY);
    });

    it('Tries to update the delays with wrong configuration (revert expected)', async () => {
      const wrongConfigs = [
        encodeSimpleActionsSet(bridgeExecutor.address, 'updateDelay(uint256)', [MAXIMUM_DELAY + 1]),
        encodeSimpleActionsSet(bridgeExecutor.address, 'updateDelay(uint256)', [MINIMUM_DELAY - 1]),
        encodeSimpleActionsSet(bridgeExecutor.address, 'updateMinimumDelay(uint256)', [DELAY + 1]),
        encodeSimpleActionsSet(bridgeExecutor.address, 'updateMaximumDelay(uint256)', [DELAY - 1]),
      ];
      const errors = [
        ExecutorErrors.DelayLongerThanMax,
        ExecutorErrors.DelayShorterThanMin,
        ExecutorErrors.DelayShorterThanMin,
        ExecutorErrors.DelayLongerThanMax,
      ];
      for (const wrongConfig of wrongConfigs) {
        expect(
          await AMBForeignChain.redirect(bridgeExecutor.address, wrongConfig.encodedData)
        );
      }

      const executionTime = (await timeLatest()).add(DELAY);
      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      for (let i = 0; i < errors.length; i++) {
        await expect(bridgeExecutor.execute(i)).to.be.revertedWith(errors[i]);
      }
    });
  });

  context('Update AMB Bridge parameters', () => {
    it('Tries to update any AMB executor parameter without being itself', async () => {
      const randomAddress = ONE_ADDRESS;
      const randomChainId = "0x000000000000000000000000000000000000000000000000000000000000002b";
      const calls = [
        { fn: 'setAmb', params: [randomAddress] },
        { fn: 'setController', params: [randomAddress] },
        { fn: 'setChainId', params: [randomChainId] },
      ];
      for (const call of calls) {
        await expect(bridgeExecutor[call.fn](...call.params)).to.be.revertedWith(
          ExecutorErrors.OnlyCallableByThis
        );
      }
    });

    it('Update AMB contract', async () => {
      expect(await bridgeExecutor.amb()).to.be.equal(AMBForeignChain.address);

      const NEW_AMB_ADDRESS = ZERO_ADDRESS;

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'setAmb(address)',
        [NEW_AMB_ADDRESS]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'AmbAddressUpdated')
        .withArgs(AMBForeignChain.address, NEW_AMB_ADDRESS);

      expect(await bridgeExecutor.amb()).to.be.equal(NEW_AMB_ADDRESS);
    });

    it('Update controller sender', async () => {
      expect(await bridgeExecutor.controller()).to.be.equal(HomeChainController.address);

      const NEW_CONTROLLER_ADDRESS = ZERO_ADDRESS;

      const { data, encodedData } = encodeSimpleActionsSet(
        bridgeExecutor.address,
        'setController(address)',
        [NEW_CONTROLLER_ADDRESS]
      );
      const tx = await AMBForeignChain.redirect(bridgeExecutor.address, encodedData);

      const executionTime = (await timeLatest()).add(DELAY);
      expect(tx)
        .to.emit(bridgeExecutor, 'ActionsSetQueued')
        .withArgs(0, data[0], data[1], data[2], data[3], data[4], executionTime);

      await setBlocktime(executionTime.add(1).toNumber());
      await advanceBlocks(1);

      expect(await bridgeExecutor.execute(0))
        .to.emit(bridgeExecutor, 'ActionsSetExecuted')
        .withArgs(0, user.address, ['0x'])
        .to.emit(bridgeExecutor, 'ControllerUpdated')
        .withArgs(HomeChainController.address, NEW_CONTROLLER_ADDRESS);

      expect(await bridgeExecutor.controller()).to.be.equal(NEW_CONTROLLER_ADDRESS);
    });
  });
});