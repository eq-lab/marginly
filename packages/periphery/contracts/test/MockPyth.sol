// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract MockPyth is IPyth {
    error NotImplemented();

    mapping(bytes32 => PythStructs.Price) public prices;

    function setPrice(bytes32 id, int64 price, int32 expo) external {
        prices[id] = PythStructs.Price({
            price: price,
            conf: 0,
            expo: expo,
            publishTime: 0
        });
    }

    function getPrice(
        bytes32 id
    ) external view returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getValidTimePeriod() external view returns (uint validTimePeriod) {
        revert NotImplemented();
    }

    function getEmaPrice(
        bytes32 id
    ) external view returns (PythStructs.Price memory price) {
        revert NotImplemented();
    }

    function getPriceUnsafe(
        bytes32 id
    ) external view returns (PythStructs.Price memory price) {
        revert NotImplemented();
    }

    function getPriceNoOlderThan(
        bytes32 id,
        uint age
    ) external view returns (PythStructs.Price memory price) {
        revert NotImplemented();
    }

    function getEmaPriceUnsafe(
        bytes32 id
    ) external view returns (PythStructs.Price memory price) {
        revert NotImplemented();
    }

    function getEmaPriceNoOlderThan(
        bytes32 id,
        uint age
    ) external view returns (PythStructs.Price memory price) {
        revert NotImplemented();
    }

    function updatePriceFeeds(bytes[] calldata updateData) external payable {
        revert NotImplemented();
    }

    function updatePriceFeedsIfNecessary(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64[] calldata publishTimes
    ) external payable {
        revert NotImplemented();
    }

    function getUpdateFee(
        bytes[] calldata updateData
    ) external view returns (uint feeAmount) {
        revert NotImplemented();
    }

    function parsePriceFeedUpdates(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythStructs.PriceFeed[] memory priceFeeds) {
        revert NotImplemented();
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythStructs.PriceFeed[] memory priceFeeds) {
        revert NotImplemented();
    }
}
