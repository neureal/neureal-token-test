const TESTToken = artifacts.require('./TESTToken.sol');
console.log('TESTToken.defaults:\n', TESTToken.defaults());

const deployGas = 2200000;
const deployGasPrice = 5000000000;

function findEvent (res, evnt) {
  for (let i = 0; i < res.logs.length; i++) {
    if (res.logs[i].event == evnt) return true;
  }
  return false;
}

function calculateGasByTransaction(transaction) {
    const tx = web3.eth.getTransaction(transaction.tx);
    return tx.gasPrice.mul(transaction.receipt.gasUsed);
}

function toETHString (bignum) {
  let str = (bignum.eq(0)) ? '0' : bignum.div(10 ** 18).toFormat();
  let parts = str.split('.', 2);
  if (!parts[1]) parts[1] = '';
  let padded = ('[' + parts[0]).padStart(10) + '.' + parts[1].padEnd(18, '0') + ']';
  return padded;
}

contract('TESTToken', async (accounts) => {
  // accounts[0] is owner/contract creator
  const CONTRACT_CREATOR_ADDRESS = accounts[0];
  console.log('accounts[0] owner: ', accounts[0]);
  // accounts[1-8] is buyer
  const BUYER_ADDRESS = accounts[1];
  console.log('accounts[1] buyer1: ', BUYER_ADDRESS);
  console.log('accounts[2] buyer2: ', accounts[2]);
  // accounts[8] is NEUREAL_ETH_WALLET
  const NEUREAL_ETH_WALLET_ADDRESS = accounts[8];
  console.log('accounts[8] ETH wallet: ', accounts[8]);
  // accounts[9] is WHITELIST_PROVIDER
  const WHITELIST_PROVIDER_ADDRESS = accounts[9];
  console.log('accounts[9] whitelist provider: ', accounts[9]);

  // let receipt = await web3.eth.sendTransaction({from: accounts[0], to: accounts[1], value: web3.toWei(1.0, "ether"), gas: 4712388, gasPrice: 100000000000});
  // console.log('receipt: ', receipt);

  // CREATION

  it('creation: contract should deploy with less than 4.7 mil gas', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let receipt = await web3.eth.getTransactionReceipt(instance.transactionHash);
    console.log('Contract creation (gasUsed): ', receipt.gasUsed);
    assert.isBelow(receipt.gasUsed, 4700000);
  });

  it('creation: sending ether with contract deployment should revert', async () => {
    try {
      var result = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: web3.toWei(0.00001, 'ether'), gas: deployGas, gasPrice: deployGasPrice});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('creation: test correct setting of state variables', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let NEUREAL_ETH_WALLET = await instance.NEUREAL_ETH_WALLET.call();
    assert.strictEqual(NEUREAL_ETH_WALLET, NEUREAL_ETH_WALLET_ADDRESS);

    let WHITELIST_PROVIDER = await instance.WHITELIST_PROVIDER.call();
    assert.strictEqual(WHITELIST_PROVIDER, WHITELIST_PROVIDER_ADDRESS);

    let OPENING_RATE = await instance.OPENING_RATE.call();
    assert.equal(OPENING_RATE, 6400);

    let MAX_SALE = await instance.MAX_SALE.call();
    assert.equal(MAX_SALE, 700 * 10 ** 18);

    let MIN_PURCHASE = await instance.MIN_PURCHASE.call();
    assert.equal(MIN_PURCHASE, 7 * 10 ** 18);

    let MAX_ALLOCATION = await instance.MAX_ALLOCATION.call();
    assert.equal(MAX_ALLOCATION, 50 * 10 ** 18);

    let MAX_SUPPLY = await instance.MAX_SUPPLY.call();
    assert.isTrue(MAX_SUPPLY.eq(MAX_SALE.add(MAX_ALLOCATION)));

    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    let MAX_WEI_WITHDRAWAL_test = new web3.BigNumber(70 * 10 ** 18);
    // console.log('MAX_WEI_WITHDRAWAL: ', MAX_WEI_WITHDRAWAL_test.dividedToIntegerBy(OPENING_RATE).div(10 ** 18).toFormat());
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
    assert.strictEqual(phase.toFormat(), '0');

    let totalSupply = await instance.totalSupply.call();
    assert.equal(totalSupply, 0);
  });

  it('creation: test correct setting of vanity information', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let name = await instance.name.call();
    assert.strictEqual(name, 'Neureal TGE Test');

    let symbol = await instance.symbol.call();
    assert.strictEqual(symbol, 'TEST');

    let decimals = await instance.decimals.call();
    assert.strictEqual(decimals.toNumber(), 18);
  });

  it('creation: should return an initial balance of 0 token for the creator', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let estimateGas = await instance.balanceOf.estimateGas(CONTRACT_CREATOR_ADDRESS);
    console.log('balanceOf() (estimateGas): ', estimateGas);

    let balanceOf = await instance.balanceOf.call(CONTRACT_CREATOR_ADDRESS);
    assert.strictEqual(balanceOf.toNumber(), 0 * 10 ** 18);
  });

  // ERC20 Transfers

  it('transfers: ERC20 token transfer should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
      var result = await instance.transfer(BUYER_ADDRESS, 100, {from: CONTRACT_CREATOR_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  // Allocate

  it('allocate: allocate if not owner should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
      var result = await instance.allocate(accounts[2], 100 * 10 ** 18, {from: BUYER_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('allocate: allocate to address zero should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
      var result = await instance.allocate(0, 100 * 10 ** 18, {from: CONTRACT_CREATOR_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('allocate: trying to allocate over MAX_ALLOCATION should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let MAX_ALLOCATION = await instance.MAX_ALLOCATION.call();
    try {
      var result = await instance.transfer(BUYER_ADDRESS, MAX_ALLOCATION.add(1), {from: CONTRACT_CREATOR_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('allocate: trying to allocate after state Finalized should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    try {
      var result = await instance.allocate(BUYER_ADDRESS, 5 * 10 ** 18, {from: CONTRACT_CREATOR_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('allocate: should allocate 10 TEST to multiple accounts[i] and emit Transfer events', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let allocate = await instance.allocate(BUYER_ADDRESS, 10 * 10 ** 18, {from: CONTRACT_CREATOR_ADDRESS});
    console.log('allocate (gasUsed): ', allocate.receipt.gasUsed);
    assert.isTrue(findEvent(allocate, 'Transfer'));
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    assert.strictEqual(balanceOf.toNumber(), 10 * 10 ** 18);

    for (let i = 2; i < 6; i++) {
      let allocate = await instance.allocate(accounts[i], 10 * 10 ** 18, {from: CONTRACT_CREATOR_ADDRESS});
      assert.isTrue(findEvent(allocate, 'Transfer'));
      let balanceOf = await instance.balanceOf.call(accounts[i]);
      assert.strictEqual(balanceOf.toNumber(), 10 * 10 ** 18);
    }
  });

  // SPECIAL
  // test special functions

  it('transition: non-owner trying to call transition function should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
      var result = await instance.transition({from: BUYER_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('transition: should cycle state from BeforeSale to Sale to Finalized using transition function, then revert on 3rd time', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let phase = await instance.phase.call();
    assert.strictEqual(phase.toFormat(), '0');

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    phase = await instance.phase.call();
    assert.strictEqual(phase.toFormat(), '1');

    transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    phase = await instance.phase.call();
    assert.strictEqual(phase.toFormat(), '2');

    try {
      var result = await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('whitelist: non WHITELIST_PROVIDER trying to call whitelist function should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
      var result = await instance.whitelist(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('whitelist: should add address to whitelist', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
    let result = await instance.whitelisted(BUYER_ADDRESS);
    assert.isTrue(result);
  });

  // Purchase

  // TODO
  // it('purchase: trying to purchase under MIN_PURCHASE should be reverted', async () => {
  // });

  it('purchase: trying to purchase over MAX_SALE should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    let MAX_SALE = await instance.MAX_SALE.call();
    let OPENING_RATE = await instance.OPENING_RATE.call();
    let value = MAX_SALE.dividedToIntegerBy(OPENING_RATE).add(1); // Amount to purchase with
    try {
      var result = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('purchase: should purchase token by sending ether to contract fallback function', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    let value = web3.toWei(0.01, 'ether'); // Amount to purchase with
    var purchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    console.log('purchase (gasUsed): ', purchase.receipt.gasUsed);
    assert.isTrue(findEvent(purchase, 'Transfer'));
    assert.isTrue(findEvent(purchase, 'TokenPurchase'));

    let OPENING_RATE = await instance.OPENING_RATE.call();
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    // console.log('balanceOf: ', balanceOf.toFormat());
    // console.log('buy: ', toETHString(OPENING_RATE.times(value)));
    assert.isTrue(balanceOf.eq(OPENING_RATE.times(value)));
  });

  // Revert

  async function logState (log, instance, address) {
    let totalSupply = await instance.totalSupply.call();
    let totalSale = await instance.totalSale.call();
    let balanceOf = await instance.balanceOf.call(address);
    let totalWei = await instance.totalWei.call();
    let contractBalance = await web3.eth.getBalance(instance.address);
    let totalRefunds_ = await instance.totalRefunds_.call();
    console.log('%stotal_token %ssale_token %sbuyer_token   %savailable_contract_eth %sactual_contract_eth %slocked_refund_eth :' + log,
      toETHString(totalSupply), toETHString(totalSale), toETHString(balanceOf), toETHString(totalWei), toETHString(contractBalance), toETHString(totalRefunds_));
  }

  // TODO what if they purchase multiple times before revert?
  // TODO what if they purchase again after revert?
  // TODO what if they purchase again before sendRefund is called?
  // TODO what if they purchase again and revertPurchase is called again before sendRefund is called?

  it('revert: should refund ETH and return allocated token to pool', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    await logState('before purchase', instance, BUYER_ADDRESS);
    // purchase
    let value = web3.toWei(0.01, 'ether'); // Amount to purchase with
    var purchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    assert.isTrue(findEvent(purchase, 'Transfer'));
    assert.isTrue(findEvent(purchase, 'TokenPurchase'));
    await logState('after purchase', instance, BUYER_ADDRESS);
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    let OPENING_RATE = await instance.OPENING_RATE.call();
    // console.log('buy: ', toETHString(OPENING_RATE.times(value)));
    assert.isTrue(balanceOf.eq(OPENING_RATE.times(value))); // Buyer recieved the right amount of token

    // revert
    let revert = await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000}); // execute revert
    assert.isTrue(findEvent(revert, 'Transfer'));
    await logState('after revert', instance, BUYER_ADDRESS);
    console.log('revertPurchase (gasUsed): ', revert.receipt.gasUsed);

    balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    assert.isTrue(balanceOf.eq(0)); // Buyer should have 0 token
  });

  // Withdraw

  it('withdraw: should withdraw all ether in the contract up to MAX_WEI_WITHDRAWAL during Sale phase', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let transition = await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    let whitelist = await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    let value = web3.toWei(0.01, 'ether'); // Amount to purchase with
    var purchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});

    let balance_before = await web3.eth.getBalance(instance.address);
    console.log('%s eth balance, before withdraw', toETHString(balance_before));

    let withdraw = await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});

    let balance_after = await web3.eth.getBalance(instance.address);
    console.log('%s eth balance, after withdraw', toETHString(balance_after));

    // console.log('%s before,after eth difference', toETHString(balance_before.sub(balance_after)));

    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    console.log('%s MAX_WEI_WITHDRAWAL', toETHString(MAX_WEI_WITHDRAWAL));

    assert.isTrue(MAX_WEI_WITHDRAWAL.gte(balance_before.sub(balance_after)));
  });

  it('withdraw: should take everything out after purchases put X ETH in contract and sale finalized', async () => {
    // 0. Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
    let value = web3.toWei(0.01, 'ether');
    // 1. Purchase tokens on 0.01 ETH
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    // 2. Withdraw all contract balance ETH, up to MAX_WEI_WITHDRAWAL value
    let contractBalance = web3.eth.getBalance(instance.address);
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    // 3. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    // 4. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    contractBalance = web3.eth.getBalance(instance.address);
    // All eth was withdrawn from contract balance:
    assert.equal(contractBalance, 0);
  });

  it('withdraw: it should take only amount in contract, except X from purchase which is locked in revert pool', async () => {
    // 0. Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
    let value = web3.toWei(0.01, 'ether');
    // 1. Purchase tokens on 0.01 ETH
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    // 2. Refund: Lock ETH to pendingRefund pool
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value});
    // 3. Withdraw all contract balance ETH, except pendingRefund value
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    // 4. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    // 5. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractBalance = web3.eth.getBalance(instance.address);
    const bigValue = web3.toBigNumber(value);
    // Withdraw everything except
    assert.isTrue(contractBalance.eq(bigValue));
    // 6. Send refund after
    await instance.sendRefund(BUYER_ADDRESS);
    contractBalance = web3.eth.getBalance(instance.address);
    assert.equal(contractBalance, 0);
  });

  it('withdraw: It should take everything out, but the X from purchase should already be gone (SendRefund sends X ETH back to purchaser)', async () => {
    // 0. Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let value = web3.toWei(0.01, 'ether');
    const bigValue = web3.toBigNumber(value);
    // 1. Purchase tokens on 0.01 ETH
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    // 2. Refund: Lock ETH to pendingRefund pool
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value});
    let totalRefunds_ = await instance.totalRefunds_.call();
    assert.isTrue(totalRefunds_.eq(bigValue), 'Check refund pool');
    // 3. Send refund to Buyer
    const balanceBefore = web3.eth.getBalance(instance.address);
    await instance.sendRefund(BUYER_ADDRESS);
    const balanceAfter = web3.eth.getBalance(instance.address);
    assert.isTrue(balanceAfter.eq(balanceBefore.sub(bigValue)), 'Refund money should already be gone');
    // 4. Withdraw all contract balance ETH, except MAX_WEI_WITHDRAWAL value
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    // 5. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    // 6. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractBalance = web3.eth.getBalance(instance.address);
    assert.equal(contractBalance, 0)
});

it("should test calculateGasByTransaction", async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
    let value = web3.toWei(0.01, "ether");
    const bigValue = web3.toBigNumber(value)
    const balanceBefore = await web3.eth.getBalance(BUYER_ADDRESS);
    const transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    const balanceAfter = await web3.eth.getBalance(BUYER_ADDRESS);

    const gasTotal = calculateGasByTransaction(transaction);

    const balanceDiff = balanceBefore.sub(balanceAfter);
    const valueCalculated = balanceDiff.sub(gasTotal);

    assert.isTrue(valueCalculated.eq(bigValue))

});

it('purchase: trying to purchase under MIN_PURCHASE should be reverted', async () => {
  let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
  await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
  await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
  let value = web3.toWei(0.001, "ether");

  let transaction;
  try {
    transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
  } catch (err) {};

  assert.isUndefined(transaction);
});
  
});
