const TESTToken = artifacts.require("./TESTToken.sol");
console.log('TESTToken.defaults:\n', TESTToken.defaults());

const deployGas = 2200000;
const deployGasPrice = 5000000000;

function findEvent(res,evnt) {
    for (let i = 0; i < res.logs.length; i++) {
       if (res.logs[i].event == evnt) return true;
    }
    return false;
}

contract('TESTToken', async (accounts) => {

const CONTRACT_CREATOR_ADDRESS = accounts[0];
const BUYER_ADDRESS = accounts[1];
const NEUREAL_ETH_WALLET_ADDRESS = accounts[8];
const WHITELIST_PROVIDER_ADDRESS = accounts[9];

//CREATION
it("creation: contract should deploy with less than 4.7 mil gas", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let receipt = await web3.eth.getTransactionReceipt(instance.transactionHash);
    console.log('Contract creation (gasUsed): ', receipt.gasUsed);
    assert.isBelow(receipt.gasUsed, 4700000);
});

it("creation: sending ether with contract deployment should revert", async () => {
    try {
        var result = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: web3.toWei(0.00001, "ether"), gas: deployGas, gasPrice: deployGasPrice});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("creation: test correct setting of state variables", async() => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let OPENING_RATE = await instance.OPENING_RATE.call();
    assert.equal(OPENING_RATE, 7143);

    let NEUREAL_ETH_WALLET = await instance.NEUREAL_ETH_WALLET.call();
    assert.strictEqual(NEUREAL_ETH_WALLET, NEUREAL_ETH_WALLET_ADDRESS);
    
    let WHITELIST_PROVIDER = await instance.WHITELIST_PROVIDER.call();
    assert.strictEqual(WHITELIST_PROVIDER, WHITELIST_PROVIDER_ADDRESS);

    let MAX_SALE = await instance.MAX_SALE.call();
    assert.equal(MAX_SALE, 700 * 10**18);

    let MIN_PURCHASE = await instance.MIN_PURCHASE.call();
    assert.equal(MIN_PURCHASE, 7 * 10**18);

    let MAX_ALLOCATION = await instance.MAX_ALLOCATION.call();
    assert.equal(MAX_ALLOCATION, 50 * 10**18);

    let MAX_SUPPLY = await instance.MAX_SUPPLY.call();
    assert.isTrue(MAX_SUPPLY.eq(MAX_SALE.add(MAX_ALLOCATION)));

    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    let MAX_WEI_WITHDRAWAL_test = new web3.BigNumber(70 * 10**18);
    console.log('MAX_WEI_WITHDRAWAL: ', MAX_WEI_WITHDRAWAL_test.dividedToIntegerBy(OPENING_RATE).toString());
    assert.isTrue(MAX_WEI_WITHDRAWAL.eq(MAX_WEI_WITHDRAWAL_test.dividedToIntegerBy(OPENING_RATE)));

    let owner_ = await instance.owner.call();
    assert.strictEqual(owner_, CONTRACT_CREATOR_ADDRESS);

    let totalSale = await instance.totalSale.call();
    assert.equal(totalSale, 0);

    let totalWei = await instance.totalWei.call();
    assert.equal(totalWei, 0);

    let whitelisted = await instance.whitelisted.call(0);
    assert.strictEqual(whitelisted, false);

    let phase = await instance.phase.call();
    assert.strictEqual(phase.toString(10), '0');

    let totalSupply = await instance.totalSupply.call();
    assert.equal(totalSupply, 0);
});

it("creation: test correct setting of vanity information", async() => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let name = await instance.name.call();
    assert.strictEqual(name, 'Neureal TGE Test');

    let symbol = await instance.symbol.call();
    assert.strictEqual(symbol, 'TEST');

    let decimals = await instance.decimals.call();
    assert.strictEqual(decimals.toNumber(), 18);
});

it("creation: should return an initial balance of 0 token for the creator", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let estimateGas = await instance.balanceOf.estimateGas(CONTRACT_CREATOR_ADDRESS);
    console.log('balanceOf() (estimateGas): ', estimateGas);

    let balanceOf = await instance.balanceOf.call(CONTRACT_CREATOR_ADDRESS);
    assert.strictEqual(balanceOf.toNumber(), 0 * 10**18);
})



//ERC20 Transfers

it("transfers: ERC20 token transfer should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
        var result = await instance.transfer(BUYER_ADDRESS, 100, {from: CONTRACT_CREATOR_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

//Allocate

it("allocate: allocate if not owner should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
        var result = await instance.allocate(accounts[2], 100 * 10**18, {from: BUYER_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: allocate to address zero should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
        var result = await instance.allocate(0, 100 * 10**18, {from: CONTRACT_CREATOR_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: trying to allocate over MAX_ALLOCATION should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let MAX_ALLOCATION = await instance.MAX_ALLOCATION.call();
    try {
        var result = await instance.transfer(BUYER_ADDRESS, MAX_ALLOCATION.add(1), {from: CONTRACT_CREATOR_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: trying to allocate after state Finalized should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    try {
        var result = await instance.allocate(BUYER_ADDRESS, 5 * 10**18, {from: CONTRACT_CREATOR_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: should allocate 10 TEST to multiple accounts[i] and emit Transfer events", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let allocate = await instance.allocate(BUYER_ADDRESS, 10 * 10**18, {from: CONTRACT_CREATOR_ADDRESS});
    console.log('allocate (gasUsed): ', allocate.receipt.gasUsed);
    assert.isTrue(findEvent(allocate,"Transfer"));
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    assert.strictEqual(balanceOf.toNumber(), 10 * 10**18);
    
    for (let i = 2; i < 6; i++) {
        let allocate = await instance.allocate(accounts[i], 10 * 10**18, {from: CONTRACT_CREATOR_ADDRESS});
        assert.isTrue(findEvent(allocate,"Transfer"));
        let balanceOf = await instance.balanceOf.call(accounts[i]);
        assert.strictEqual(balanceOf.toNumber(), 10 * 10**18);
    }
});



//SPECIAL
//test special functions

it("transition: non-owner trying to call transition function should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
        var result = await instance.transition({from: BUYER_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("transition: should cycle state from BeforeSale to Sale to Finalized using transition function, then revert on 3rd time", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let phase = await instance.phase.call();
    assert.strictEqual(phase.toString(10), '0');

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    phase = await instance.phase.call();
    assert.strictEqual(phase.toString(10), '1');

    transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    phase = await instance.phase.call();
    assert.strictEqual(phase.toString(10), '2');

    try {
        var result = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);

});

it("whitelist: non WHITELIST_PROVIDER trying to call whitelist function should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
        var result = await instance.whitelist(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("whitelist: should add address to whitelist", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
    let result = await instance.whitelisted(BUYER_ADDRESS);
    assert.isTrue(result);
});


//Purchase

it("purchase: trying to purchase over MAX_SALE should be reverted", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); //set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); //must be whitelisted

    let MAX_SALE = await instance.MAX_SALE.call();
    let OPENING_RATE = await instance.OPENING_RATE.call();
    let value = MAX_SALE.dividedToIntegerBy(OPENING_RATE).add(1) ; //Amount to purchase with
    try {
        var result = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("purchase: should purchase token by sending ether to contract fallback function", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); //set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); //must be whitelisted
    
    let value = web3.toWei(0.01, "ether"); //Amount to purchase with
    var purchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    console.log('purchase (gasUsed): ', purchase.receipt.gasUsed);
    assert.isTrue(findEvent(purchase,"Transfer"));
    assert.isTrue(findEvent(purchase,"TokenPurchase"));
    
    let OPENING_RATE = await instance.OPENING_RATE.call();
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    // console.log('balanceOf: ', balanceOf.toString(10));
    // console.log('buy: ', OPENING_RATE.times(value).toString(10));
    assert.isTrue(balanceOf.eq(OPENING_RATE.times(value)));
});

it("withdrawl: should withdrawl all ether in the contract up to MAX_WEI_WITHDRAWAL", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); //set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); //must be whitelisted
    
    let value = web3.toWei(0.01, "ether"); //Amount to purchase with
    var purchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    
    let balance_before = await web3.eth.getBalance(instance.address);
    console.log('before withdraw: balance[%s]', balance_before.toString(10));

    let withdraw = await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});

    let balance_after = await web3.eth.getBalance(instance.address);
    console.log('after withdraw: balance[%s]', balance_after.toString(10));

    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    assert.isTrue(MAX_WEI_WITHDRAWAL.eq(balance_before.sub(balance_after)));
});

//Revert

it("revert: should refund ETH and return allocated token to pool", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    
    let OPENING_RATE = await instance.OPENING_RATE.call();

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); //set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); //must be whitelisted
    
    let totalSupply = await instance.totalSupply.call();
    let totalSale = await instance.totalSale.call();
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    let totalWei = await instance.totalWei.call();
    let balance = await web3.eth.getBalance(instance.address);
    let totalRefunds_ = await instance.totalRefunds_.call();
    console.log('before purchase: total_token[%s] sale_token[%s] buyer_token[%s]   tracked_contract_wei[%s] actual_contract_wei[%s] locked_refund_wei[%s]',
        totalSupply.toString(10), totalSale.toString(10), balanceOf.toString(10), totalWei.toString(10), balance.toString(10), totalRefunds_.toString(10));
    

    // purchase
    let value = web3.toWei(0.01, "ether"); //Amount to purchase with
    var purchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    assert.isTrue(findEvent(purchase,"Transfer"));
    assert.isTrue(findEvent(purchase,"TokenPurchase"));

    totalSupply = await instance.totalSupply.call();
    totalSale = await instance.totalSale.call();
    balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    totalWei = await instance.totalWei.call();
    balance = await web3.eth.getBalance(instance.address);
    totalRefunds_ = await instance.totalRefunds_.call();
    console.log('before refund: total_token[%s] sale_token[%s] buyer_token[%s]   tracked_contract_wei[%s] actual_contract_wei[%s] locked_refund_wei[%s]',
        totalSupply.toString(10), totalSale.toString(10), balanceOf.toString(10), totalWei.toString(10), balance.toString(10), totalRefunds_.toString(10));
    
    // console.log('buy: ', OPENING_RATE.times(value).toString(10));
    assert.isTrue(balanceOf.eq(OPENING_RATE.times(value)));


    // revert
    let revert = await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000}); //execute revert
    console.log('revertPurchase (gasUsed): ', revert.receipt.gasUsed);
    assert.isTrue(findEvent(revert,"Transfer"));

    totalSupply = await instance.totalSupply.call();
    totalSale = await instance.totalSale.call();
    balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    totalWei = await instance.totalWei.call();
    balance = await web3.eth.getBalance(instance.address);
    totalRefunds_ = await instance.totalRefunds_.call();
    console.log('after revert: total_token[%s] sale_token[%s] buyer_token[%s]   tracked_contract_wei[%s] actual_contract_wei[%s] locked_refund_wei[%s]',
        totalSupply.toString(10), totalSale.toString(10), balanceOf.toString(10), totalWei.toString(10), balance.toString(10), totalRefunds_.toString(10));
    
    assert.isTrue(balanceOf.eq(0));

});

it("withdraw: it should take everything out after Purchase put X ETH in contract", async () => {
    // Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let initBalance = await web3.eth.getBalance(BUYER_ADDRESS);
    let value = web3.toWei(0.01, "ether");

    // 1. Purchase tokens on 0.01 ETH
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    const contractBalanceBeforeWithdraw = await web3.eth.getBalance(instance.address)

    // 2. Withdraw all contract balance ETH, except MAX_WEI_WITHDRAWAL value
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});

    let contractAfterBalance = await web3.eth.getBalance(instance.address);
    const contractEthLeft = contractBalanceBeforeWithdraw.sub(MAX_WEI_WITHDRAWAL);
    assert.isTrue(contractAfterBalance.eq(contractEthLeft), 'Withdraw everything, but MAX_WEI_WITHDRAWAL should left')

    // 3. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    
    // 4. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});

    let contractFinalBalance = await web3.eth.getBalance(instance.address);
    assert.equal(contractFinalBalance, 0, 'Should withdraw everything after sale ends')

});

it("withdraw: it should take only amount in contract, except X from purchase wich is locked in revert pool", async () => {
    // Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let initContractBalance = await web3.eth.getBalance(instance.address);
    let initBalance = await web3.eth.getBalance(BUYER_ADDRESS);
    let initRefunds = await instance.pendingRefunds_(BUYER_ADDRESS);

    // 1. Purchase tokens on 0.01 ETH
    let value = web3.toWei(0.01, "ether");
    let transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    const tx = await web3.eth.getTransaction(transaction.tx);

    let balanceAfter = await web3.eth.getBalance(BUYER_ADDRESS);
    let contractBalanceAfter = await web3.eth.getBalance(instance.address);
    
    let transactionValue = new web3.BigNumber(value);
    let transactionGasCost = tx.gasPrice.mul(transaction.receipt.gasUsed);
    const transactionTotalCost = transactionValue.plus(transactionGasCost);
    
    assert.isTrue(contractBalanceAfter.sub(initContractBalance).eq(transactionValue), 'Contract receive sended value')
    assert.isTrue(initBalance.minus(balanceAfter).eq(transactionTotalCost), 'User spend value + gas for transaction')

    // 2. Refund: Lock ETH to pendingRefund pool
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value});
    let balanceAfterRevert = await web3.eth.getBalance(BUYER_ADDRESS);
    let pendingRefunds = await instance.pendingRefunds_(BUYER_ADDRESS);

    assert.isTrue(balanceAfterRevert.eq(balanceAfter), 'ETH should be locked, not sended');
    assert.isTrue(pendingRefunds.eq(value), 'Refunds should be placed to refund pool')

    // 3. Withdraw all contract balance ETH, except pendingRefund value
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractAfterBalance = await web3.eth.getBalance(instance.address);
    let totalRefunds_ = await instance.totalRefunds_.call();
    console.log('contractAfterBalance: ', contractAfterBalance.toNumber())
    console.log('pendingRefunds: ', pendingRefunds.toNumber())
    assert.isTrue(contractBalanceAfter.eq(pendingRefunds),
        'Should withdraw not more then MAX_WEI_WITHDRAWAL'
    );

    // 4. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    
    // 5. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractFinalBalance = await web3.eth.getBalance(instance.address);
    assert.isTrue(contractFinalBalance.eq(transactionValue),
        'Should withdraw everything including MAX_WEI_WITHDRAWAL, but refund pending pool should left'
    )

});

it("withdraw: It should take everything out but the X from purchase should already be gone (SendRefund sends X ETH back to purchaser)", async () => {
    // Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let initBalance = await web3.eth.getBalance(BUYER_ADDRESS);
    let initRefunds = await instance.pendingRefunds_(BUYER_ADDRESS);

    // 1. Purchase tokens on 0.01 ETH
    let value = web3.toWei(0.01, "ether");
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    let balanceAfter = await web3.eth.getBalance(BUYER_ADDRESS);
    assert.ok(initBalance.greaterThan(balanceAfter), 'Balance withdraw transaction cost');

    // 2. Refund: Lock ETH to pendingRefund pool
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value});
    let balanceAfterRevert = await web3.eth.getBalance(BUYER_ADDRESS);
    let pendingRefunds = await instance.pendingRefunds_(BUYER_ADDRESS);

    assert.equal(balanceAfterRevert.toNumber(), balanceAfter.toNumber(), 'ETH should be locked, not sended');
    assert.equal(pendingRefunds, value, 'Refunds should be placed to refund pool')
    assert.ok(pendingRefunds.greaterThan(initRefunds), 'Pending refund is greater than initial refund state');
   
    // 3. Send refund to Buyer
    await instance.sendRefund(BUYER_ADDRESS);
    let balanceAfterRefund = await web3.eth.getBalance(BUYER_ADDRESS);
    let finalRefunds = await instance.pendingRefunds_(BUYER_ADDRESS);

    assert.ok(balanceAfterRefund.greaterThan(balanceAfterRevert), 'ETH should be sended back to Buyer');
    assert.equal(initRefunds.toNumber(), finalRefunds.toNumber(), 'Refunds pool cleared');

    // 4. Withdraw all contract balance ETH, except MAX_WEI_WITHDRAWAL value
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractAfterBalance = await web3.eth.getBalance(instance.address);
    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    let transactionValue = new web3.BigNumber(value);

    assert.equal(contractAfterBalance.toNumber(), transactionValue.sub(MAX_WEI_WITHDRAWAL).toNumber(10),
        'Should withdraw everything, except value from revert pending pool + MAX_WEI_WITHDRAWAL'
    );

    // 5. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    
    // 6. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractFinalBalance = await web3.eth.getBalance(instance.address);
    assert.equal(contractFinalBalance, 0,
        'Should withdraw everything including MAX_WEI_WITHDRAWAL, value from purchase already gone'
    )

});
});
