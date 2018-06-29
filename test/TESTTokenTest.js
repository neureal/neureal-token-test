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

//accounts[0] is owner/contract creator
console.log('accounts[0] owner: ', accounts[0]);
//accounts[1-8] is buyer
console.log('accounts[1] buyer1: ', accounts[1]);
//accounts[8] is NEUREAL_ETH_WALLET
console.log('accounts[8] ETH wallet: ', accounts[8]);
//accounts[9] is WHITELIST_PROVIDER
console.log('accounts[9] whitelist provider: ', accounts[9]);

// let receipt = await web3.eth.sendTransaction({from: accounts[0], to: accounts[1], value: web3.toWei(1.0, "ether"), gas: 4712388, gasPrice: 100000000000});
// console.log('receipt: ', receipt);
let instance;

beforeEach('some description', async () => {
    // beforeEach:some description
    instance = await TESTToken.new(accounts[8], accounts[9], {from: accounts[0], gas: deployGas, gasPrice: deployGasPrice});

});

//CREATION

it("creation: contract should deploy with less than 4.7 mil gas", async () => {
    let receipt = await web3.eth.getTransactionReceipt(instance.transactionHash);
    console.log('Contract creation (gasUsed): ', receipt.gasUsed);
    assert.isBelow(receipt.gasUsed, 4700000);
});

it("creation: sending ether with contract deployment should revert", async () => {
    try {
        var result = await TESTToken.new(accounts[8], accounts[9], {from: accounts[0], value: web3.toWei(0.00001, "ether"), gas: deployGas, gasPrice: deployGasPrice});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("creation: test correct setting of state variables", async() => {

    let OPENING_RATE = await instance.OPENING_RATE.call();
    assert.equal(OPENING_RATE, 7143);

    let NEUREAL_ETH_WALLET = await instance.NEUREAL_ETH_WALLET.call();
    assert.strictEqual(NEUREAL_ETH_WALLET, accounts[8]);
    
    let WHITELIST_PROVIDER = await instance.WHITELIST_PROVIDER.call();
    assert.strictEqual(WHITELIST_PROVIDER, accounts[9]);

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

    let owner_ = await instance.owner_.call();
    assert.strictEqual(owner_, accounts[0]);

    let totalSale = await instance.totalSale.call();
    assert.equal(totalSale, 0);

    let totalWei = await instance.totalWei.call();
    assert.equal(totalWei, 0);

    let whitelist_ = await instance.whitelist_.call(0);
    assert.strictEqual(whitelist_, false);

    let phase_ = await instance.phase_.call();
    assert.strictEqual(phase_.toString(10), '0');

    let totalSupply = await instance.totalSupply.call();
    assert.equal(totalSupply, 0);
});

it("creation: test correct setting of vanity information", async() => {
    let name = await instance.name.call();
    assert.strictEqual(name, 'Neureal TGE Test');

    let symbol = await instance.symbol.call();
    assert.strictEqual(symbol, 'TEST');

    let decimals = await instance.decimals.call();
    assert.strictEqual(decimals.toNumber(), 18);
});

it("creation: should return an initial balance of 0 token for the creator", async () => {
    let estimateGas = await instance.balanceOf.estimateGas(accounts[0]);
    console.log('balanceOf() (estimateGas): ', estimateGas);

    let balanceOf = await instance.balanceOf.call(accounts[0]);
    assert.strictEqual(balanceOf.toNumber(), 0 * 10**18);
})



//ERC20 Transfers

it("transfers: ERC20 token transfer should be reverted", async () => {
    try {
        var result = await instance.transfer(accounts[1], 100, {from: accounts[0]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

//Allocate

it("allocate: allocate if not owner should be reverted", async () => {
    try {
        var result = await instance.allocate(accounts[2], 100 * 10**18, {from: accounts[1]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: allocate to address zero should be reverted", async () => {
    try {
        var result = await instance.allocate(0, 100 * 10**18, {from: accounts[0]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: trying to allocate over MAX_ALLOCATION should be reverted", async () => {
    let MAX_ALLOCATION = await instance.MAX_ALLOCATION.call();
    try {
        var result = await instance.transfer(accounts[1], MAX_ALLOCATION.add(1), {from: accounts[0]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: trying to allocate after state Finalized should be reverted", async () => {
    let transition = await instance.transition({from: accounts[0]});
    transition = await instance.transition({from: accounts[0]});
    try {
        var result = await instance.allocate(accounts[1], 5 * 10**18, {from: accounts[0]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("allocate: should allocate 10 TEST to multiple accounts[i] and emit Transfer events", async () => {
    let allocate = await instance.allocate(accounts[1], 10 * 10**18, {from: accounts[0]});
    console.log('allocate (gasUsed): ', allocate.receipt.gasUsed);
    assert.isTrue(findEvent(allocate,"Transfer"));
    let balanceOf = await instance.balanceOf.call(accounts[1]);
    assert.strictEqual(balanceOf.toNumber(), 10 * 10**18);
    
    for (let i = 2; i < 6; i++) {
        let allocate = await instance.allocate(accounts[i], 10 * 10**18, {from: accounts[0]});
        assert.isTrue(findEvent(allocate,"Transfer"));
        let balanceOf = await instance.balanceOf.call(accounts[i]);
        assert.strictEqual(balanceOf.toNumber(), 10 * 10**18);
    }
});



//SPECIAL
//test special functions

it("transition: non-owner trying to call transition function should be reverted", async () => {
    try {
        var result = await instance.transition({from: accounts[1]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("transition: should cycle state from BeforeSale to Sale to Finalized using transition function, then revert on 3rd time", async () => {
    let phase_ = await instance.phase_.call();
    assert.strictEqual(phase_.toString(10), '0');

    let transition = await instance.transition({from: accounts[0]});
    phase_ = await instance.phase_.call();
    assert.strictEqual(phase_.toString(10), '1');

    transition = await instance.transition({from: accounts[0]});
    phase_ = await instance.phase_.call();
    assert.strictEqual(phase_.toString(10), '2');

    try {
        var result = await instance.transition({from: accounts[0]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);

});

it("whitelist: non WHITELIST_PROVIDER trying to call whitelist function should be reverted", async () => {
    try {
        var result = await instance.whitelist(accounts[1], {from: accounts[0]});
    } catch(err) { } //console.log(err.message); }
    assert.isUndefined(result);
});

it("whitelist: should add address to whitelist", async () => {
    let whitelist = await instance.whitelist(accounts[1], {from: accounts[9]});
    let result = await instance.whitelist_(accounts[1]);
    assert.isTrue(result);
});


//Purchase

it("purchase: trying to purchase over MAX_SALE should be reverted", async () => {
    let transition = await instance.transition({from: accounts[0]}); //set to Sale
    let whitelist = await instance.whitelist(accounts[1], {from: accounts[9]}); //must be whitelisted

    let MAX_SALE = await instance.MAX_SALE.call();
    let OPENING_RATE = await instance.OPENING_RATE.call();
    let value = MAX_SALE.dividedToIntegerBy(OPENING_RATE).add(1) ; //Amount to purchase with
    try {
        var result = await instance.sendTransaction({from: accounts[1], value: value, gas: 4712388, gasPrice: 100000000000});
    } catch(err) { console.log(err.message); }
    assert.isUndefined(result);
});

it("purchase: should purchase token by sending ether to contract fallback function", async () => {
    let transition = await instance.transition({from: accounts[0]}); //set to Sale
    let whitelist = await instance.whitelist(accounts[1], {from: accounts[9]}); //must be whitelisted
    
    let value = web3.toWei(0.01, "ether"); //Amount to purchase with
    var purchase = await instance.sendTransaction({from: accounts[1], value: value, gas: 4712388, gasPrice: 100000000000});
    console.log('purchase (gasUsed): ', purchase.receipt.gasUsed);
    assert.isTrue(findEvent(purchase,"Transfer"));
    assert.isTrue(findEvent(purchase,"TokenPurchase"));
    
    let OPENING_RATE = await instance.OPENING_RATE.call();
    let balanceOf = await instance.balanceOf.call(accounts[1]);
    // console.log('balanceOf: ', balanceOf.toString(10));
    // console.log('buy: ', OPENING_RATE.times(value).toString(10));
    assert.isTrue(balanceOf.eq(OPENING_RATE.times(value)));
});

it("withdrawl: should withdrawl all ether in the contract up to MAX_WEI_WITHDRAWAL", async () => {
    let transition = await instance.transition({from: accounts[0]}); //set to Sale
    let whitelist = await instance.whitelist(accounts[1], {from: accounts[9]}); //must be whitelisted
    
    let value = web3.toWei(0.01, "ether"); //Amount to purchase with
    var purchase = await instance.sendTransaction({from: accounts[1], value: value, gas: 4712388, gasPrice: 100000000000});
    
    let balance_before = await web3.eth.getBalance(instance.address);
    console.log('before withdraw: balance[%s]', balance_before.toString(10));

    let withdraw = await instance.withdraw({from: accounts[0]});

    let balance_after = await web3.eth.getBalance(instance.address);
    console.log('after withdraw: balance[%s]', balance_after.toString(10));

    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    assert.isTrue(MAX_WEI_WITHDRAWAL.eq(balance_before.sub(balance_after)));
});

//Refund

it("refund: should refund ETH and return their token to pool", async () => {
    let OPENING_RATE = await instance.OPENING_RATE.call();

    let transition = await instance.transition({from: accounts[0]}); //set to Sale
    let whitelist = await instance.whitelist(accounts[1], {from: accounts[9]}); //must be whitelisted
    
    let totalSupply = await instance.totalSupply.call();
    let totalSale = await instance.totalSale.call();
    let balanceOf = await instance.balanceOf.call(accounts[1]);
    let totalWei = await instance.totalWei.call();
    let balance = await web3.eth.getBalance(instance.address);
    let totalRefunds_ = await instance.totalRefunds_.call();
    console.log('before purchase: total_token[%s] sale_token[%s] buyer_token[%s]   tracked_contract_wei[%s] actual_contract_wei[%s] locked_refund_wei[%s]',
        totalSupply.toString(10), totalSale.toString(10), balanceOf.toString(10), totalWei.toString(10), balance.toString(10), totalRefunds_.toString(10));
    

    // purchase
    let value = web3.toWei(0.01, "ether"); //Amount to purchase with
    var purchase = await instance.sendTransaction({from: accounts[1], value: value, gas: 4712388, gasPrice: 100000000000});
    assert.isTrue(findEvent(purchase,"Transfer"));
    assert.isTrue(findEvent(purchase,"TokenPurchase"));

    totalSupply = await instance.totalSupply.call();
    totalSale = await instance.totalSale.call();
    balanceOf = await instance.balanceOf.call(accounts[1]);
    totalWei = await instance.totalWei.call();
    balance = await web3.eth.getBalance(instance.address);
    totalRefunds_ = await instance.totalRefunds_.call();
    console.log('before refund: total_token[%s] sale_token[%s] buyer_token[%s]   tracked_contract_wei[%s] actual_contract_wei[%s] locked_refund_wei[%s]',
        totalSupply.toString(10), totalSale.toString(10), balanceOf.toString(10), totalWei.toString(10), balance.toString(10), totalRefunds_.toString(10));
    
    // console.log('buy: ', OPENING_RATE.times(value).toString(10));
    assert.isTrue(balanceOf.eq(OPENING_RATE.times(value)));


    // refund
    let refund = await instance.refund(accounts[1], {from: accounts[0], value: value, gas: 4712388, gasPrice: 100000000000}); //execute refund
    console.log('refund (gasUsed): ', refund.receipt.gasUsed);
    assert.isTrue(findEvent(refund,"Transfer"));

    totalSupply = await instance.totalSupply.call();
    totalSale = await instance.totalSale.call();
    balanceOf = await instance.balanceOf.call(accounts[1]);
    totalWei = await instance.totalWei.call();
    balance = await web3.eth.getBalance(instance.address);
    totalRefunds_ = await instance.totalRefunds_.call();
    console.log('after refund: total_token[%s] sale_token[%s] buyer_token[%s]   tracked_contract_wei[%s] actual_contract_wei[%s] locked_refund_wei[%s]',
        totalSupply.toString(10), totalSale.toString(10), balanceOf.toString(10), totalWei.toString(10), balance.toString(10), totalRefunds_.toString(10));
    
    assert.isTrue(balanceOf.eq(0));

});

});
