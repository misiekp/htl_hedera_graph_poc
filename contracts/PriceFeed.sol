// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PriceFeed {
    address public owner;
    mapping(bytes32 => uint256) public prices;
    
    event PriceUpdated(bytes32 asset, uint256 price, uint256 timestamp);
    event OwnershipTransferred(address previousOwner, address newOwner);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    function updatePrice(bytes32 asset, uint256 price) public onlyOwner {
        prices[asset] = price;
        emit PriceUpdated(asset, price, block.timestamp);
    }
    
    function getPrice(bytes32 asset) public view returns (uint256) {
        return prices[asset];
    }
    
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
} 