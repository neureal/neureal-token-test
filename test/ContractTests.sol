pragma solidity 0.4.24;

import "../contracts/TESTToken.sol";

contract ContractTests {
    TESTToken public subject;

    constructor(address _subject) public {
        subject = TESTToken(_subject);
    }

    function kill() public {
        selfdestruct(msg.sender);
    }

    function purchase() public payable {
        require(address(subject).call.value(msg.value)());
    }

    uint[100] private t;
    uint private i;
    function() public payable {
        
        // Test double purchase.
        // address(subject).call.value(0.01 ether)();

        // Test infinite recursion. Reverts
        // subject.sendRefund(address(this));

        // Test reentrancy ordering. Does not call sendRefund
        // if (subject.pendingRefunds_(address(this)) > 0) {
        //     subject.sendRefund(address(this));
        // }

        // Test call stack depth attack. This wont work
        // if (i == 1023) foo();
        // else {
        //     i++; attack();
        // }

        // Test infinate loop. Uses up gas and reverts. If lower .gas() added to call then reduces the time.
        // while (true) { }

        // Test executing above the 2300 gas stipend
        // for (uint i = 0; i < 40; i++) {
        //     t[i] = i;
        // }
    }
}
