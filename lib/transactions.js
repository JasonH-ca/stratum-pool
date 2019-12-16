var bitcoin = require('bitcoinjs-lib-fab');
var util = require('./util.js');

// public members
var txHash;

exports.txHash = function(){
  return txHash;
};

function scriptCompile(addrHash){
    script = bitcoin.script.compile(
        [
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,
            addrHash,
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG
        ]);
    return script;
}

function scriptFoundersCompile(address){
    script = bitcoin.script.compile(
        [
            bitcoin.opcodes.OP_HASH160,
            address,
            bitcoin.opcodes.OP_EQUAL
        ]);
    return script;
}


exports.createGeneration = function(rpcData, blockReward, feeReward, recipients, poolAddress){
    var poolAddrHash = bitcoin.address.fromBase58Check(poolAddress).hash;
    var tx = new bitcoin.Transaction();
    var blockHeight = parseInt(rpcData.height);
    // input for coinbase tx
    var serializedBlockHeight;
    if (1 <= blockHeight && blockHeight <= 16) {
        serializedBlockHeight = Buffer.from([0x50 + blockHeight, 0]);
    } else {
        var cbHeightBuff = bitcoin.script.number.encode(blockHeight);
        serializedBlockHeight = new Buffer.concat([
            Buffer.from([cbHeightBuff.length]),
            cbHeightBuff,
            new Buffer('00', 'hex') // OP_0
        ]);
    }

    tx.addInput(new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        4294967295,
        4294967295,
        new Buffer.concat([serializedBlockHeight,
            Buffer('4641422d4d494e494e472d504f4f4c2d303031', 'hex')])
    );

    // calculate total fees
    var feePercent = 0;
    for (var i = 0; i < recipients.length; i++) {
        feePercent = feePercent + recipients[i].percent;
    }
    
    tx.addOutput(
                 scriptCompile(poolAddrHash),
                 Math.floor(blockReward * (1 - (feePercent / 100)))
                 );
    for (var i = 0; i < recipients.length; i++) {
       tx.addOutput(
           scriptCompile(bitcoin.address.fromBase58Check(recipients[i].address).hash),
           Math.round(blockReward * (recipients[i].percent / 100))
       );
    }

    if (rpcData.default_witness_commitment !== undefined) {
        tx.addOutput(new Buffer(rpcData.default_witness_commitment, 'hex'), 0);
    }

    txHex = tx.toHex();

    // assign
    txHash = tx.getHash().toString('hex');

    /*
    console.log('txHex: ' + txHex.toString('hex'));
    console.log('txHash: ' + txHash);
    */

    return txHex;
};

exports.createGenerationFromRpc = function(rpcData, address) {
    var addrHash = bitcoin.address.fromBase58Check(address).hash;
    var blockHeight = parseInt(rpcData.height);
    // input for coinbase tx
    var serializedBlockHeight;
    if (1 <= blockHeight && blockHeight <= 16) {
        serializedBlockHeight = Buffer.from([0x50 + blockHeight, 0]);
    } else {
        var cbHeightBuff = bitcoin.script.number.encode(blockHeight);
        serializedBlockHeight = new Buffer.concat([
            Buffer.from([cbHeightBuff.length]),
            cbHeightBuff,
            new Buffer('00', 'hex') // OP_0
        ]);
    }
    var tx = bitcoin.Transaction.fromHex(rpcData.coinbasetxn.data);
    tx.outs[0].script = scriptCompile(addrHash);
    tx.ins[0].script = new Buffer.concat([serializedBlockHeight, Buffer('4641422d4d494e494e472d504f4f4c2d303031', 'hex')]);
    txHash = tx.getHash().toString('hex');
    return tx.toHex();
}


module.exports.getFees = function(feeArray){
    var fee = Number();
    feeArray.forEach(function(value) {
        fee = fee + Number(value.fee);
    });
    return fee;
};
