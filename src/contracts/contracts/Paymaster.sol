// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/core/UserOperationLib.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract HalalPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for PackedUserOperation;

    address public signerAddress;
    bool public paused;
    uint256 public constant MAX_GAS_PER_OP = 0.01 ether;

    uint256 private constant VALID_TIMESTAMP_OFFSET = PAYMASTER_DATA_OFFSET;
    uint256 private constant SIGNATURE_OFFSET = VALID_TIMESTAMP_OFFSET + 64;

    event OperationSponsored(address indexed sender, uint256 gasCost, bool success);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event Paused(bool status);

    constructor(
        IEntryPoint _entryPoint,
        address _signer,
        address _owner
    ) BasePaymaster(_entryPoint) {
        require(_signer != address(0), "invalid signer");
        signerAddress = _signer;
        _transferOwnership(_owner);
    }

    // matches exactly what backend signs
function getHash(
    PackedUserOperation calldata userOp,
    uint48 validUntil,
    uint48 validAfter
) public view returns (bytes32) {
    address sender = userOp.getSender();
    return keccak256(abi.encode(
        sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        block.chainid,
        address(this),
        validUntil,
        validAfter
    ));
}

    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public pure returns (uint48 validUntil, uint48 validAfter, bytes calldata signature)
    {
        (validUntil, validAfter) = abi.decode(
            paymasterAndData[VALID_TIMESTAMP_OFFSET:],
            (uint48, uint48)
        );
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }

    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {

        if (paused) {
            return ("", _packValidationData(true, 0, 0));
        }

        (uint48 validUntil, uint48 validAfter, bytes calldata signature) =
            parsePaymasterAndData(userOp.paymasterAndData);

        if (maxCost > MAX_GAS_PER_OP) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(
            getHash(userOp, validUntil, validAfter)
        );

        if (signerAddress != ECDSA.recover(hash, signature)) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }

        context = abi.encode(userOp.sender, maxCost);
        return (context, _packValidationData(false, validUntil, validAfter));
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        (address sender, ) = abi.decode(context, (address, uint256));
        emit OperationSponsored(sender, actualGasCost, mode == PostOpMode.opSucceeded);
    }

    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "invalid signer");
        emit SignerUpdated(signerAddress, newSigner);
        signerAddress = newSigner;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
}