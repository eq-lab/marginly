// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ILBLegacyPair} from '../priceAdapters/traderJoeV2/ILBLegacyPair.sol';
import {Constants} from '../priceAdapters/traderJoeV2/Constants.sol';
import {Math128x128} from '../priceAdapters/traderJoeV2/Math128x128.sol';
import "hardhat/console.sol";

contract LBPair is ILBLegacyPair {
    using Math128x128 for uint256;
    error BinHelper__IdOverflows();
    error BinHelper__BinStepOverflows(uint256 bp);

    uint16 internal constant BIN_STEP = 15;
    function tokenX() external view returns (IERC20) {}

    function tokenY() external view returns (IERC20) {}

    function factory() external view returns (address) {}

    function getReservesAndId() external view returns (uint256 reserveX, uint256 reserveY, uint256 activeId) {}

    function getGlobalFees()
        external
        view
        returns (uint128 feesXTotal, uint128 feesYTotal, uint128 feesXProtocol, uint128 feesYProtocol) {}

    function getOracleParameters()
        external
        view
        returns (
            uint256 oracleSampleLifetime,
            uint256 oracleSize,
            uint256 oracleActiveSize,
            uint256 oracleLastTimestamp,
            uint256 oracleId,
            uint256 min,
            uint256 max
        ) {}

    function getOracleSampleFrom(uint256 timeDelta)
        external
        pure
        returns (uint256 cumulativeId, uint256 cumulativeAccumulator, uint256 cumulativeBinCrossed) {
            return _getOracleSampleFrom(timeDelta);
    }

    function _getOracleSampleFrom(uint256 timeDelta) internal pure returns (
        uint256 cumulativeId,
        uint256 cumulativeAccumulator,
        uint256 cumulativeBinCrossed) {
            // from https://arbiscan.io/address/0x7ec3717f70894f6d9ba0be00774610394ce006ee#readContract
            if(timeDelta == 0) {
                return (14227544613696290, 144689234174, 9747459);
            } else {
                return (14227544010683618, 144687376674, 9747459);
            }
    }

    function getTWAP(uint256 timeDelta) external pure returns (uint256) {
        (uint256 id0,,) = _getOracleSampleFrom(timeDelta);
        (uint256 id1,,) = _getOracleSampleFrom(0);
        uint256 averageId = (id1 - id0) / timeDelta;
        return (getPriceFromId(averageId, BIN_STEP));
    }

    function _getPriceFromId(uint256 id) external pure returns (uint256) {
        return (getPriceFromId(id, BIN_STEP));
    }

    function getPriceFromId(uint256 _id, uint256 _binStep) internal pure returns (uint256) {
    if (_id > uint256(type(uint24).max)) revert BinHelper__IdOverflows();
      unchecked {
          int256 _realId = int256(_id) - Constants.REAL_ID_SHIFT;
          // max real_id = 1048576
          uint256 x = _getBPValue(_binStep);
          uint256 absY;
          assembly {
              absY := _realId
              if slt(absY, 0) {
                  absY := sub(0, absY)
              }
          }
          console.log("x %s y %s isneg %s", x, absY, _realId < 0);

          return x.power(_realId);
      }
    }

    function _getBPValue(uint256 _binStep) internal pure returns (uint256) {
        if (_binStep == 0 || _binStep > Constants.BASIS_POINT_MAX) revert BinHelper__BinStepOverflows(_binStep);

        unchecked {
            // can't overflow as `max(result) = 2**128 + 10_000 << 128 / 10_000 < max(uint256)`
            return Constants.SCALE + (_binStep << Constants.SCALE_OFFSET) / Constants.BASIS_POINT_MAX;
        }
    }

    function feeParameters() external view returns (FeeParameters memory) {}

    function findFirstNonEmptyBinId(uint24 id_, bool sentTokenY) external view returns (uint24 id) {}

    function getBin(uint24 id) external view returns (uint256 reserveX, uint256 reserveY) {}

    function pendingFees(address account, uint256[] memory ids)
        external
        view
        returns (uint256 amountX, uint256 amountY) {}

    function swap(bool sentTokenY, address to) external returns (uint256 amountXOut, uint256 amountYOut) {}

    function flashLoan(address receiver, IERC20 token, uint256 amount, bytes calldata data) external {}

    function mint(
        uint256[] calldata ids,
        uint256[] calldata distributionX,
        uint256[] calldata distributionY,
        address to
    ) external returns (uint256 amountXAddedToPair, uint256 amountYAddedToPair, uint256[] memory liquidityMinted) {}

    function burn(uint256[] calldata ids, uint256[] calldata amounts, address to)
        external
        returns (uint256 amountX, uint256 amountY) {}

    function increaseOracleLength(uint16 newSize) external {}

    function collectFees(address account, uint256[] calldata ids) external returns (uint256 amountX, uint256 amountY) {}

    function collectProtocolFees() external returns (uint128 amountX, uint128 amountY) {}

    function setFeesParameters(bytes32 packedFeeParameters) external {}

    function forceDecay() external {}

    function initialize(
        IERC20 _tokenX,
        IERC20 _tokenY,
        uint24 activeId,
        uint16 sampleLifetime,
        bytes32 packedFeeParameters
    ) external {}

    function name() external view returns (string memory) {}

    function symbol() external view returns (string memory) {}

    function balanceOf(address account, uint256 id) external view returns (uint256) {}

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory batchBalances) {}

    function totalSupply(uint256 id) external view returns (uint256) {}

    function isApprovedForAll(address owner, address spender) external view returns (bool) {}

    function setApprovalForAll(address sender, bool approved) external {}

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount) external {}

    function safeBatchTransferFrom(address from, address to, uint256[] calldata id, uint256[] calldata amount)
        external {}

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {}
}