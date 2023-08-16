//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

interface IBridgeExecutor {
  function queue(
    address[] memory targets,
    uint256[] memory values,
    string[] memory signatures,
    bytes[] memory calldatas,
    bool[] memory withDelegatecalls
  ) external;
}

contract MockAMB {
  address public sender;
  bytes32 public sourceChainId;

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
    address[] memory targets,
    uint256[] memory values,
    string[] memory signatures,
    bytes[] memory calldatas,
    bool[] memory withDelegatecalls
  ) external {
    IBridgeExecutor(_target).queue(
      targets,
      values,
      signatures,
      calldatas,
      withDelegatecalls
    );
  }
}