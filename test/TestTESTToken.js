const TESTToken = artifacts.require('./TESTToken.sol');
const ContractTests = artifacts.require('./ContractTests.sol');
console.log('TESTToken.defaults:\n', TESTToken.defaults());

const deployGas = 2200000;
const deployGasPrice = 5000000000;

function toETHString (bignum) {
  return (bignum.eq(0)) ? '0' : bignum.div(10 ** 18).toFormat();
}

function findEvent (res, evnt) {
  for (let i = 0; i < res.logs.length; i++) {
    if (res.logs[i].event == evnt) return true;
  }
  return false;
}

function calculateGasByTransaction (transaction) {
  const tx = web3.eth.getTransaction(transaction.tx);
  return tx.gasPrice.mul(transaction.receipt.gasUsed);
}

function fromETHtoWeiBN (eth) {
  return web3.toWei(web3.toBigNumber(eth), 'ether');
}

const permutator = (inputArr) => {
  let result = [];
  const permute = (arr, m = []) => {
    if (arr.length === 0) {
      result.push(m)
    } else {
      for (let i = 0; i < arr.length; i++) {
        let curr = arr.slice();
        let next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next))
      }
    }
  }
  permute(inputArr)
  return result;
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

  // let receipt = await web3.eth.sendTransaction({from: accounts[0], to: accounts[1], value: fromETHtoWeiBN(1.0), gas: 4712388, gasPrice: 100000000000});
  // console.log('receipt: ', receipt);

  it('reentrancy: should not be suseptable to reentrancy', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    let instanceTests = await ContractTests.new(instance.address, {from: BUYER_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    await instance.whitelist(instanceTests.address, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    // try { let purchase = await instanceTests.purchase({from: BUYER_ADDRESS, value: fromETHtoWeiBN(0.02), gas: 4712388, gasPrice: 100000000000}); } catch (err) { }
    let purchase = await instanceTests.purchase({from: BUYER_ADDRESS, value: fromETHtoWeiBN(0.02), gas: 4712388, gasPrice: 100000000000});
    console.log('contract purchase (gasUsed): ', purchase.receipt.gasUsed);

    let purchaseBuyer = await instance.sendTransaction({from: BUYER_ADDRESS, value: fromETHtoWeiBN(0.02), gas: 4712388, gasPrice: 100000000000});
    console.log('regular purchase (gasUsed): ', purchaseBuyer.receipt.gasUsed);

    await instance.revertPurchase(instanceTests.address, {from: CONTRACT_CREATOR_ADDRESS, gas: 4712388, gasPrice: 100000000000});
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: 4712388, gasPrice: 100000000000});

    try { var refund = await instance.sendRefund(instanceTests.address, {from: BUYER_ADDRESS, gas: 4712388, gasPrice: 100000000000}); } catch (err) { console.log('contract refund revert'); }
    if (refund) console.log('contract refund (gasUsed): ', refund.receipt.gasUsed);

    var refundBuyer = await instance.sendRefund(BUYER_ADDRESS, {from: BUYER_ADDRESS, gas: 4712388, gasPrice: 100000000000});
    console.log('regular refund (gasUsed): ', refundBuyer.receipt.gasUsed);

    let contractBalance = await web3.eth.getBalance(instance.address);
    console.log('Contract balance: ', toETHString(contractBalance));
    let contractBalanceTests = await web3.eth.getBalance(instanceTests.address);
    console.log('Test Contract balance: ', toETHString(contractBalanceTests));
  });

  // CREATION

  it('creation: contract should deploy with less than 4.7 mil gas', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let receipt = await web3.eth.getTransactionReceipt(instance.transactionHash);
    console.log('Contract creation (gasUsed): ', receipt.gasUsed);
    assert.isBelow(receipt.gasUsed, 4700000);
  });

  it('creation: sending ether with contract deployment should revert', async () => {
    try {
      var result = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: fromETHtoWeiBN(0.00001), gas: deployGas, gasPrice: deployGasPrice});
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
    // console.log('MAX_WEI_WITHDRAWAL: ', toETHString(web3.toBigNumber(70 * 10 ** 18).dividedToIntegerBy(OPENING_RATE)));
    assert.isTrue(MAX_WEI_WITHDRAWAL.eq(web3.toBigNumber(70 * 10 ** 18).dividedToIntegerBy(OPENING_RATE)));

    let owner_ = await instance.owner.call();
    assert.strictEqual(owner_, CONTRACT_CREATOR_ADDRESS);

    let totalSale = await instance.totalSale.call();
    assert.equal(totalSale, 0);

    let totalSaleWei = await instance.totalSaleWei.call();
    assert.equal(totalSaleWei, 0);

    let whitelisted = await instance.whitelisted.call(0);
    assert.strictEqual(whitelisted, false);

    let saleStarted = await instance.saleStarted.call();
    assert.strictEqual(saleStarted, false);

    let saleFinalized = await instance.saleFinalized.call();
    assert.strictEqual(saleFinalized, false);

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
    assert.equal(decimals, 18);
  });

  it('creation: should return an initial balance of 0 token for the creator', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let estimateGas = await instance.balanceOf.estimateGas(CONTRACT_CREATOR_ADDRESS);
    console.log('balanceOf() (estimateGas): ', estimateGas);

    let balanceOf = await instance.balanceOf.call(CONTRACT_CREATOR_ADDRESS);
    assert.equal(balanceOf, 0 * 10 ** 18);
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

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
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
    assert.equal(balanceOf, 10 * 10 ** 18);

    for (let i = 2; i < 6; i++) {
      let allocate = await instance.allocate(accounts[i], 10 * 10 ** 18, {from: CONTRACT_CREATOR_ADDRESS});
      assert.isTrue(findEvent(allocate, 'Transfer'));
      let balanceOf = await instance.balanceOf.call(accounts[i]);
      assert.equal(balanceOf, 10 * 10 ** 18);
    }
  });

  // SPECIAL
  // test special functions

  it('should test calculateGasByTransaction', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let value = fromETHtoWeiBN(0.01);
    const balanceBefore = await web3.eth.getBalance(BUYER_ADDRESS);
    const transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    const balanceAfter = await web3.eth.getBalance(BUYER_ADDRESS);

    const gasTotal = calculateGasByTransaction(transaction);

    const balanceDiff = balanceBefore.sub(balanceAfter);
    const valueCalculated = balanceDiff.sub(gasTotal);

    assert.isTrue(valueCalculated.eq(value));
  });

  it('transition: non-owner trying to call transition function should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    try {
      var result = await instance.transition({from: BUYER_ADDRESS});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(result);
  });

  it('transition: should first set saleStarted, then set saleFinalized, then revert on 3rd time', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    let saleStarted = await instance.saleStarted.call();
    let saleFinalized = await instance.saleFinalized.call();
    assert.strictEqual(saleStarted, false);
    assert.strictEqual(saleFinalized, false);

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    saleStarted = await instance.saleStarted.call();
    saleFinalized = await instance.saleFinalized.call();
    assert.strictEqual(saleStarted, true);
    assert.strictEqual(saleFinalized, false);

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    saleStarted = await instance.saleStarted.call();
    saleFinalized = await instance.saleFinalized.call();
    assert.strictEqual(saleStarted, true);
    assert.strictEqual(saleFinalized, true);

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

    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});
    let result = await instance.whitelisted(BUYER_ADDRESS);
    assert.isTrue(result);
  });

  // Purchase

  it('purchase: trying to purchase under MIN_PURCHASE should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let value = fromETHtoWeiBN(0.001);
    try {
      var transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});
    } catch (err) { } // console.log(err.message); }
    assert.isUndefined(transaction);
  });

  it('purchase: trying to purchase over MAX_SALE should be reverted', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

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

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    let value = fromETHtoWeiBN(0.01); // Amount to purchase with
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
    let totalSaleWei = await instance.totalSaleWei.call();
    let contractBalance = await web3.eth.getBalance(instance.address);
    let pendingRefunds_ = await instance.pendingRefunds_.call(address);
    let totalRefunds_ = await instance.totalRefunds_.call();
    let neurealEthBalance = await web3.eth.getBalance(NEUREAL_ETH_WALLET_ADDRESS);
    console.log('total_token[%s] sale_token[%s] buyer_token[%s]   total_sale_eth[%s] actual_contract_eth[%s] buyer_pending_refund_eth[%s] total_locked_refund_eth[%s] neureal_eth_wallet[%s]:' + log,
      toETHString(totalSupply), toETHString(totalSale), toETHString(balanceOf), toETHString(totalSaleWei), toETHString(contractBalance), toETHString(pendingRefunds_), toETHString(totalRefunds_), toETHString(neurealEthBalance));
  }

  it('revert: should refund ETH and return allocated token to pool', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    await logState('before purchase', instance, BUYER_ADDRESS);
    // purchase
    let value = fromETHtoWeiBN(0.01); // Amount to purchase with
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

  it('revert: if purchase again and revertPurchase is called again before sendRefund is called', async () => {
    const instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    // 1. Purchase (again)
    const value = fromETHtoWeiBN(0.01);
    let buyerBalanceBefore = web3.eth.getBalance(BUYER_ADDRESS);
    let transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    let transactionCost = calculateGasByTransaction(transaction);

    const valueSecond = fromETHtoWeiBN(0.02);
    transaction = await instance.sendTransaction({from: BUYER_ADDRESS, value: valueSecond});
    transactionCost = transactionCost.plus(calculateGasByTransaction(transaction));

    let balanceBeforeWithPaidGas = buyerBalanceBefore.sub(transactionCost);
    // 2. revertPurchase
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    let pendingRefunds_ = await instance.pendingRefunds_.call(BUYER_ADDRESS);

    assert.isTrue(pendingRefunds_.eq(value.plus(valueSecond)));
    let buyerTokenBalance = await instance.balanceOf.call(BUYER_ADDRESS);

    assert.isTrue(buyerTokenBalance.eq(0));
    // 3. SendRefund called (Gas payed by contract creator)
    await instance.sendRefund(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    const buyerBalanceAfter = web3.eth.getBalance(BUYER_ADDRESS);
    assert.isTrue(balanceBeforeWithPaidGas.eq(buyerBalanceAfter));
  });

  it('revert: should not affect purchase after revert and before sendRefund functions call', async () => {
    const instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let OPENING_RATE = await instance.OPENING_RATE.call();

    // 1. Purchase
    const balanceBeforePurchase = new web3.eth.getBalance(BUYER_ADDRESS);
    const valueFirst = fromETHtoWeiBN(0.02);

    const firstPurchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: valueFirst});
    // 2. revertPurchase
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    // 3. Purchase here (again)
    const valueSecond = fromETHtoWeiBN(0.01);
    const secondPurchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: valueSecond});

    let tokenBalance = await instance.balanceOf.call(BUYER_ADDRESS);
    let buyedTokens = OPENING_RATE.mul(valueSecond);
    // Check token balance for second purchase only
    assert.isTrue(tokenBalance.eq(buyedTokens));

    // 4. SendRefund called (Gas payed by contract creator)
    await instance.sendRefund(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    // Check that user still has tokens for second transaction
    let buyerTokenBalance = await instance.balanceOf.call(BUYER_ADDRESS);
    assert.isTrue(tokenBalance.eq(buyerTokenBalance));
    // Check that refundSended for first purchase:
    const balanceAfterPurchase = web3.eth.getBalance(BUYER_ADDRESS);

    const firstTransactionGas = calculateGasByTransaction(firstPurchase);
    const secondTransactionGas = calculateGasByTransaction(secondPurchase);
    const totalPurchaseGas = firstTransactionGas.plus(secondTransactionGas);
    const totalPurchaseValue = totalPurchaseGas.plus(valueSecond);

    assert.isTrue(balanceAfterPurchase.eq(balanceBeforePurchase.minus(totalPurchaseValue)));
  });

  it('revert: should not affect purchase after revert and before sendRefund functions call', async () => {
    const instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    const value = fromETHtoWeiBN(0.02);
    const balanceBeforePurchase = new web3.eth.getBalance(BUYER_ADDRESS);
    // 1. Purchase
    const firstPurchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    // 2. Purchase here (again)
    const secondPurchase = await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    // 3. revertPurchase
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});
    // 4. SendRefund called (Gas payed by contract creator)
    await instance.sendRefund(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS});

    const balanceAfterRefund = new web3.eth.getBalance(BUYER_ADDRESS);

    const firstTransactionGas = calculateGasByTransaction(firstPurchase);
    const secondTransactionGas = calculateGasByTransaction(secondPurchase);
    const totalGas = firstTransactionGas.plus(secondTransactionGas);
    // Test refunded eth amount
    assert.isTrue(balanceBeforePurchase.eq(balanceAfterRefund.plus(totalGas)));
    // Test neureal tokens amount
    let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
    assert.isTrue(balanceOf.eq(0));
  });

  // Withdraw

  it('withdraw: should withdraw all ether in the contract up to MAX_WEI_WITHDRAWAL during Sale phase', async () => {
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

    await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

    let value = fromETHtoWeiBN(0.02); // Amount to purchase with
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value, gas: 4712388, gasPrice: 100000000000});

    let balanceBefore = await web3.eth.getBalance(instance.address);
    console.log('contract_balance_eth[%s] :before withdraw', toETHString(balanceBefore));

    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});

    let balanceAfter = await web3.eth.getBalance(instance.address);
    console.log('contract_balance_eth[%s] :after withdraw', toETHString(balanceAfter));

    console.log('before/after difference[%s]', toETHString(balanceBefore.sub(balanceAfter)));
    let MAX_WEI_WITHDRAWAL = await instance.MAX_WEI_WITHDRAWAL.call();
    console.log('MAX_WEI_WITHDRAWAL[%s]', toETHString(MAX_WEI_WITHDRAWAL));

    assert.isTrue(balanceBefore.sub(balanceAfter).lte(MAX_WEI_WITHDRAWAL)); // can't take out more than MAX_WEI_WITHDRAWAL
  });

  it('withdraw: should take everything out after purchases put X ETH in contract and sale finalized', async () => {
    // 0. Create contract, set to Sale, must be whitelisted
    let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS});

    let value = fromETHtoWeiBN(0.01);
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

    let value = fromETHtoWeiBN(0.01);
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
    // Withdraw everything except
    assert.isTrue(contractBalance.eq(value));
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

    let value = fromETHtoWeiBN(0.01);
    // 1. Purchase tokens on 0.01 ETH
    await instance.sendTransaction({from: BUYER_ADDRESS, value: value});
    // 2. Refund: Lock ETH to pendingRefund pool
    await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: value});
    let totalRefunds_ = await instance.totalRefunds_.call();
    assert.isTrue(totalRefunds_.eq(value), 'Check refund pool');
    // 3. Send refund to Buyer
    const balanceBefore = web3.eth.getBalance(instance.address);
    await instance.sendRefund(BUYER_ADDRESS);
    const balanceAfter = web3.eth.getBalance(instance.address);
    assert.isTrue(balanceAfter.eq(balanceBefore.sub(value)), 'Refund money should already be gone');
    // 4. Withdraw all contract balance ETH, except MAX_WEI_WITHDRAWAL value
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    // 5. Set Finalized phase for withdraw everything:
    await instance.transition({from: CONTRACT_CREATOR_ADDRESS});
    // 6. Withdraw all ETH
    await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS});
    let contractBalance = web3.eth.getBalance(instance.address);
    assert.equal(contractBalance, 0);
  });

  const runPurchase = async (instance) => {
    try { await instance.sendTransaction({from: BUYER_ADDRESS, value: fromETHtoWeiBN(0.02), gas: 4712388, gasPrice: 100000000000}); } catch (err) { console.log('purchase revert'); }
    await logState('after purchase', instance, BUYER_ADDRESS);
  }
  const runWithdraw = async (instance) => {
    try { await instance.withdraw({from: CONTRACT_CREATOR_ADDRESS, gas: 4712388, gasPrice: 100000000000}); } catch (err) { console.log('withdraw revert'); }
    await logState('after withdraw', instance, BUYER_ADDRESS);
  }
  const runRevert = async (instance) => {
    try { await instance.revertPurchase(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, value: fromETHtoWeiBN(0.02), gas: 4712388, gasPrice: 100000000000}); } catch (err) { console.log('revertPurchase revert'); }
    await logState('after revertPurchase', instance, BUYER_ADDRESS);
  }
  const runRefund = async (instance) => {
    try { await instance.sendRefund(BUYER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: 4712388, gasPrice: 100000000000}); } catch (err) { console.log('sendRefund revert'); }
    await logState('after sendRefund', instance, BUYER_ADDRESS);
  }
  permutator([runWithdraw, runRevert, runRefund]).forEach((element) => {
    it('withdraw: test miner transaction re-ordering (totalRefunds_ affected by revertPurchase and sendRefund)', async () => {
      let instance = await TESTToken.new(NEUREAL_ETH_WALLET_ADDRESS, WHITELIST_PROVIDER_ADDRESS, {from: CONTRACT_CREATOR_ADDRESS, gas: deployGas, gasPrice: deployGasPrice});

      await instance.transition({from: CONTRACT_CREATOR_ADDRESS}); // set to Sale
      await instance.whitelist(BUYER_ADDRESS, {from: WHITELIST_PROVIDER_ADDRESS}); // must be whitelisted

      // await logState('initial state', instance, BUYER_ADDRESS);

      await instance.sendTransaction({from: BUYER_ADDRESS, value: fromETHtoWeiBN(0.02), gas: 4712388, gasPrice: 100000000000});
      await logState('after purchase', instance, BUYER_ADDRESS);

      for (let run of element) {
        await run(instance);
      }

      //  no matter what order
      let balanceOf = await instance.balanceOf.call(BUYER_ADDRESS);
      assert.equal(balanceOf, 0); // revertPurchase should always set buyer token balance to zero
      
      let contractBalance = await web3.eth.getBalance(instance.address);
      let pendingRefunds_ = await instance.pendingRefunds_.call(BUYER_ADDRESS);
      let totalRefunds_ = await instance.totalRefunds_.call();
      assert.isTrue(pendingRefunds_.eq(totalRefunds_)); // must still be able to get refund
      assert.isTrue(totalRefunds_.gte(pendingRefunds_)); // funds must still be available
    });
  });
});
