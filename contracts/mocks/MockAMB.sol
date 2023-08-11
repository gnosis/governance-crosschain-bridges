//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

interface IBridgeExecutor {
  function processMessageFromAMB(bytes calldata data) external;
}

contract MockAMB {
  address public sender;
  bytes32 public sourceChainId;
  bool public madeIt;

  function setMessageSender(address _sender) public {
  	sender = _sender;
  }

  function setMessageSourceChainId(bytes32 _chainId) public {
  	sourceChainId = _chainId;
  }

  function messageSender() external view returns (address) {
  	return sender;
  }

  function messageSourceChainId() external view returns (bytes32) {
  	return sourceChainId;
  }

  function redirect(
    address _target,
    bytes calldata _message
  ) external {
    // bool success;
    // (success, ) = _target.call{gas: 4000000}(abi.encodeWithSignature("processMessageFromAMB(bytes)", _message));
    // madeIt = success;
    IBridgeExecutor(_target).processMessageFromAMB(_message);
  }
}