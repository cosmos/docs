#!/usr/bin/env node
/**
 * Comprehensive EVM JSON-RPC Test Script
 * Tests all JSON-RPC methods against localhost node
 *
 * Usage: node test-evm-rpc.js [rpc-url] [ws-url]
 * Default: http://localhost:8545 ws://localhost:8546
 */

const axios = require('axios');
const WebSocket = require('ws');
const { ethers } = require('ethers');

// Configuration
const RPC_URL = process.argv[2] || 'http://localhost:8545';
const WS_URL = process.argv[3] || 'ws://localhost:8546';

// Test account (you may need to update this)
const TEST_ACCOUNT = '<your>test>wallet>';
const TEST_PRIVATE_KEY = '<your_test_key>';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Test results storage
const results = {
  passed: [],
  failed: [],
  notImplemented: [],
  skipped: []
};

// Helper function to make JSON-RPC calls
async function rpcCall(method, params = []) {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// Helper to log test results
function logTest(method, status, message = '') {
  const statusColors = {
    'PASS': colors.green,
    'FAIL': colors.red,
    'NOT_IMPL': colors.yellow,
    'SKIP': colors.gray
  };

  console.log(`${statusColors[status]}[${status}]${colors.reset} ${method} ${message ? `- ${message}` : ''}`);

  switch(status) {
    case 'PASS': results.passed.push(method); break;
    case 'FAIL': results.failed.push({ method, message }); break;
    case 'NOT_IMPL': results.notImplemented.push(method); break;
    case 'SKIP': results.skipped.push(method); break;
  }
}

// Test categories
const tests = {
  // Web3 Methods
  web3: async () => {
    console.log(`\n${colors.cyan}=== Web3 Methods ===${colors.reset}`);

    // web3_clientVersion
    const clientVersion = await rpcCall('web3_clientVersion');
    if (clientVersion.success) {
      logTest('web3_clientVersion', 'PASS', clientVersion.data.result);
    } else {
      logTest('web3_clientVersion', 'FAIL', clientVersion.error.message);
    }

    // web3_sha3
    const sha3 = await rpcCall('web3_sha3', ['0x68656c6c6f20776f726c64']);
    if (sha3.success) {
      logTest('web3_sha3', 'PASS');
    } else {
      logTest('web3_sha3', 'FAIL', sha3.error.message);
    }
  },

  // Net Methods
  net: async () => {
    console.log(`\n${colors.cyan}=== Net Methods ===${colors.reset}`);

    const methods = ['net_version', 'net_peerCount', 'net_listening'];
    for (const method of methods) {
      const result = await rpcCall(method);
      if (result.success) {
        logTest(method, 'PASS', JSON.stringify(result.data.result));
      } else {
        logTest(method, 'FAIL', result.error.message);
      }
    }
  },

  // Core Eth Methods
  eth_core: async () => {
    console.log(`\n${colors.cyan}=== Core Eth Methods ===${colors.reset}`);

    // eth_protocolVersion
    const protocolVersion = await rpcCall('eth_protocolVersion');
    logTest('eth_protocolVersion', protocolVersion.success ? 'PASS' : 'FAIL');

    // eth_syncing
    const syncing = await rpcCall('eth_syncing');
    logTest('eth_syncing', syncing.success ? 'PASS' : 'FAIL');

    // eth_gasPrice
    const gasPrice = await rpcCall('eth_gasPrice');
    logTest('eth_gasPrice', gasPrice.success ? 'PASS' : 'FAIL');

    // eth_accounts
    const accounts = await rpcCall('eth_accounts');
    logTest('eth_accounts', accounts.success ? 'PASS' : 'FAIL');

    // eth_blockNumber
    const blockNumber = await rpcCall('eth_blockNumber');
    logTest('eth_blockNumber', blockNumber.success ? 'PASS' : 'FAIL');

    // eth_chainId
    const chainId = await rpcCall('eth_chainId');
    logTest('eth_chainId', chainId.success ? 'PASS' : 'FAIL');
  },

  // Account & State Methods
  eth_state: async () => {
    console.log(`\n${colors.cyan}=== Account & State Methods ===${colors.reset}`);

    // eth_getBalance
    const balance = await rpcCall('eth_getBalance', [TEST_ACCOUNT, 'latest']);
    logTest('eth_getBalance', balance.success ? 'PASS' : 'FAIL');

    // eth_getTransactionCount
    const txCount = await rpcCall('eth_getTransactionCount', [TEST_ACCOUNT, 'latest']);
    logTest('eth_getTransactionCount', txCount.success ? 'PASS' : 'FAIL');

    // eth_getCode (using a known contract or zero address)
    const code = await rpcCall('eth_getCode', ['0x0000000000000000000000000000000000000000', 'latest']);
    logTest('eth_getCode', code.success ? 'PASS' : 'FAIL');

    // eth_getStorageAt
    const storage = await rpcCall('eth_getStorageAt', [TEST_ACCOUNT, '0x0', 'latest']);
    logTest('eth_getStorageAt', storage.success ? 'PASS' : 'FAIL');

    // eth_getProof
    const proof = await rpcCall('eth_getProof', [TEST_ACCOUNT, ['0x0'], 'latest']);
    logTest('eth_getProof', proof.success ? 'PASS' : 'FAIL');
  },

  // Block Methods
  eth_blocks: async () => {
    console.log(`\n${colors.cyan}=== Block Methods ===${colors.reset}`);

    // Get current block number first
    const blockNumResult = await rpcCall('eth_blockNumber');
    if (!blockNumResult.success) return;

    const blockNumber = blockNumResult.data.result;

    // eth_getBlockByNumber
    const blockByNum = await rpcCall('eth_getBlockByNumber', [blockNumber, false]);
    logTest('eth_getBlockByNumber', blockByNum.success ? 'PASS' : 'FAIL');

    if (blockByNum.success && blockByNum.data.result) {
      const blockHash = blockByNum.data.result.hash;

      // eth_getBlockByHash
      const blockByHash = await rpcCall('eth_getBlockByHash', [blockHash, false]);
      logTest('eth_getBlockByHash', blockByHash.success ? 'PASS' : 'FAIL');

      // eth_getBlockTransactionCountByHash
      const txCountByHash = await rpcCall('eth_getBlockTransactionCountByHash', [blockHash]);
      logTest('eth_getBlockTransactionCountByHash', txCountByHash.success ? 'PASS' : 'FAIL');
    }

    // eth_getBlockTransactionCountByNumber
    const txCountByNum = await rpcCall('eth_getBlockTransactionCountByNumber', [blockNumber]);
    logTest('eth_getBlockTransactionCountByNumber', txCountByNum.success ? 'PASS' : 'FAIL');

    // eth_getBlockReceipts
    const blockReceipts = await rpcCall('eth_getBlockReceipts', [blockNumber]);
    logTest('eth_getBlockReceipts', blockReceipts.success ? 'PASS' : 'FAIL');

    // Uncle methods (should return 0/null for Cosmos)
    const uncleCount = await rpcCall('eth_getUncleCountByBlockNumber', [blockNumber]);
    logTest('eth_getUncleCountByBlockNumber', uncleCount.success ? 'PASS' : 'FAIL');
  },

  // Transaction Methods
  eth_transactions: async () => {
    console.log(`\n${colors.cyan}=== Transaction Methods ===${colors.reset}`);

    // eth_estimateGas
    const estimateGas = await rpcCall('eth_estimateGas', [{
      from: TEST_ACCOUNT,
      to: TEST_ACCOUNT,
      value: '0x1'
    }]);
    logTest('eth_estimateGas', estimateGas.success ? 'PASS' : 'FAIL');

    // eth_call
    const call = await rpcCall('eth_call', [{
      to: TEST_ACCOUNT,
      data: '0x'
    }, 'latest']);
    logTest('eth_call', call.success ? 'PASS' : 'FAIL');

    // eth_sendRawTransaction (would need a signed tx)
    logTest('eth_sendRawTransaction', 'SKIP', 'Requires signed transaction');

    // eth_sendTransaction (requires unlocked account)
    logTest('eth_sendTransaction', 'SKIP', 'Requires unlocked account');

    // eth_sign (requires unlocked account)
    logTest('eth_sign', 'SKIP', 'Requires unlocked account');

    // eth_signTransaction
    const signTx = await rpcCall('eth_signTransaction', [{
      from: TEST_ACCOUNT,
      to: TEST_ACCOUNT,
      value: '0x1'
    }]);
    logTest('eth_signTransaction', signTx.success ? 'PASS' : 'FAIL');

    // eth_pendingTransactions
    const pendingTx = await rpcCall('eth_pendingTransactions');
    logTest('eth_pendingTransactions', pendingTx.success ? 'PASS' : 'FAIL');
  },

  // Filter Methods
  eth_filters: async () => {
    console.log(`\n${colors.cyan}=== Filter Methods ===${colors.reset}`);

    // eth_newFilter
    const newFilter = await rpcCall('eth_newFilter', [{
      fromBlock: 'latest',
      toBlock: 'latest',
      address: TEST_ACCOUNT
    }]);
    logTest('eth_newFilter', newFilter.success ? 'PASS' : 'FAIL');

    if (newFilter.success && newFilter.data.result) {
      const filterId = newFilter.data.result;

      // eth_getFilterChanges
      const filterChanges = await rpcCall('eth_getFilterChanges', [filterId]);
      logTest('eth_getFilterChanges', filterChanges.success ? 'PASS' : 'FAIL');

      // eth_getFilterLogs
      const filterLogs = await rpcCall('eth_getFilterLogs', [filterId]);
      logTest('eth_getFilterLogs', filterLogs.success ? 'PASS' : 'FAIL');

      // eth_uninstallFilter
      const uninstall = await rpcCall('eth_uninstallFilter', [filterId]);
      logTest('eth_uninstallFilter', uninstall.success ? 'PASS' : 'FAIL');
    }

    // eth_newBlockFilter
    const blockFilter = await rpcCall('eth_newBlockFilter');
    logTest('eth_newBlockFilter', blockFilter.success ? 'PASS' : 'FAIL');

    // eth_newPendingTransactionFilter
    const pendingFilter = await rpcCall('eth_newPendingTransactionFilter');
    logTest('eth_newPendingTransactionFilter', pendingFilter.success ? 'PASS' : 'FAIL');

    // eth_getLogs
    const logs = await rpcCall('eth_getLogs', [{
      fromBlock: 'earliest',
      toBlock: 'latest',
      limit: 10
    }]);
    logTest('eth_getLogs', logs.success ? 'PASS' : 'FAIL');
  },

  // Mining Methods
  mining: async () => {
    console.log(`\n${colors.cyan}=== Mining Methods ===${colors.reset}`);

    // eth_mining
    const mining = await rpcCall('eth_mining');
    logTest('eth_mining', mining.success ? 'PASS' : 'FAIL',
      mining.success ? `Returns: ${mining.data.result}` : '');

    // eth_hashrate
    const hashrate = await rpcCall('eth_hashrate');
    logTest('eth_hashrate', hashrate.success ? 'PASS' : 'FAIL',
      hashrate.success ? `Returns: ${hashrate.data.result}` : '');

    // eth_coinbase
    const coinbase = await rpcCall('eth_coinbase');
    logTest('eth_coinbase', coinbase.success ? 'PASS' : 'FAIL');

    // Miner namespace
    const minerMethods = [
      'miner_getHashrate',
      'miner_setEtherbase',
      'miner_setExtra',
      'miner_setGasPrice',
      'miner_setGasLimit',
      'miner_start',
      'miner_stop'
    ];

    for (const method of minerMethods) {
      const result = await rpcCall(method,
        method === 'miner_setEtherbase' ? [TEST_ACCOUNT] :
        method === 'miner_start' ? [1] : []
      );
      logTest(method, result.success ? 'PASS' : 'FAIL');
    }
  },

  // EIP-1559 Methods
  eip1559: async () => {
    console.log(`\n${colors.cyan}=== EIP-1559 Methods ===${colors.reset}`);

    // eth_feeHistory
    const feeHistory = await rpcCall('eth_feeHistory', [10, 'latest', [25, 50, 75]]);
    logTest('eth_feeHistory', feeHistory.success ? 'PASS' : 'FAIL');

    // eth_maxPriorityFeePerGas
    const maxPriorityFee = await rpcCall('eth_maxPriorityFeePerGas');
    logTest('eth_maxPriorityFeePerGas', maxPriorityFee.success ? 'PASS' : 'FAIL');
  },

  // Personal Methods
  personal: async () => {
    console.log(`\n${colors.cyan}=== Personal Methods ===${colors.reset}`);

    // personal_listAccounts
    const listAccounts = await rpcCall('personal_listAccounts');
    logTest('personal_listAccounts', listAccounts.success ? 'PASS' : 'FAIL');

    // personal_newAccount
    logTest('personal_newAccount', 'SKIP', 'Modifies state');

    // personal_importRawKey
    logTest('personal_importRawKey', 'SKIP', 'Modifies state');

    // personal_unlockAccount
    logTest('personal_unlockAccount', 'SKIP', 'Requires password');

    // personal_lockAccount
    logTest('personal_lockAccount', 'SKIP', 'Requires unlocked account');

    // personal_sign
    logTest('personal_sign', 'SKIP', 'Requires unlocked account');

    // personal_ecRecover
    const ecRecover = await rpcCall('personal_ecRecover', [
      '0xdeadbeaf',
      '0xf9ff74c86aefeb5f6019d77280bbb44fb695b4d45cfe97e6eed7acd62905f4a85034d5c68ed25a2e7a8eeb9baf1b8401e4f865d92ec48c1763bf649e354d900b1c'
    ]);
    logTest('personal_ecRecover', ecRecover.success ? 'PASS' : 'FAIL');

    // personal_listWallets
    const listWallets = await rpcCall('personal_listWallets');
    logTest('personal_listWallets', listWallets.success ? 'PASS' : 'FAIL');
  },

  // TxPool Methods
  txpool: async () => {
    console.log(`\n${colors.cyan}=== TxPool Methods ===${colors.reset}`);

    const methods = ['txpool_content', 'txpool_inspect', 'txpool_status'];
    for (const method of methods) {
      const result = await rpcCall(method);
      logTest(method, result.success ? 'PASS' : 'FAIL');
    }
  },

  // Debug Methods
  debug: async () => {
    console.log(`\n${colors.cyan}=== Debug Methods ===${colors.reset}`);

    // Get a block with transactions for testing
    const blockNum = await rpcCall('eth_blockNumber');
    if (!blockNum.success) return;

    // debug_traceBlockByNumber
    const traceBlock = await rpcCall('debug_traceBlockByNumber', [blockNum.data.result]);
    logTest('debug_traceBlockByNumber', traceBlock.success ? 'PASS' : 'FAIL');

    // debug_traceBlockByHash (need a block hash)
    logTest('debug_traceBlockByHash', 'SKIP', 'Requires block hash with transactions');

    // debug_traceTransaction (need a tx hash)
    logTest('debug_traceTransaction', 'SKIP', 'Requires transaction hash');

    // Test Cosmos-specific debug methods
    const cosmosDebugMethods = [
      'debug_freeOSMemory',
      'debug_setGCPercent',
      'debug_getRawBlock',
      'debug_getRawHeader',
      'debug_getRawReceipts',
      'debug_getRawTransaction',
      'debug_printBlock'
    ];

    for (const method of cosmosDebugMethods) {
      const params = method.includes('Raw') || method === 'debug_printBlock' ?
        [blockNum.data.result] :
        method === 'debug_setGCPercent' ? [100] : [];

      const result = await rpcCall(method, params);
      logTest(method, result.success ? 'PASS' : 'FAIL');
    }
  },

  // Cosmos-specific Eth Extensions
  cosmos_extensions: async () => {
    console.log(`\n${colors.cyan}=== Cosmos-specific Extensions ===${colors.reset}`);

    // eth_getTransactionLogs (need a tx hash)
    logTest('eth_getTransactionLogs', 'SKIP', 'Requires transaction hash');

    // eth_getPendingTransactions
    const getPendingTx = await rpcCall('eth_getPendingTransactions');
    logTest('eth_getPendingTransactions', getPendingTx.success ? 'PASS' : 'FAIL');

    // eth_fillTransaction
    const fillTx = await rpcCall('eth_fillTransaction', [{
      from: TEST_ACCOUNT,
      to: TEST_ACCOUNT,
      value: '0x1'
    }]);
    logTest('eth_fillTransaction', fillTx.success ? 'PASS' : 'FAIL');

    // eth_signTypedData
    logTest('eth_signTypedData', 'SKIP', 'Requires specific typed data format');
  },

  // Engine API Methods (should all fail)
  engine: async () => {
    console.log(`\n${colors.cyan}=== Engine API Methods (Expected to fail) ===${colors.reset}`);

    const engineMethods = [
      'engine_newPayloadV1',
      'engine_forkchoiceUpdatedV1',
      'engine_getPayloadV1',
      'engine_exchangeCapabilities'
    ];

    for (const method of engineMethods) {
      const result = await rpcCall(method, []);
      logTest(method, result.success ? 'FAIL' : 'NOT_IMPL',
        'Expected to be not implemented');
    }
  },

  // Not Implemented Methods
  not_implemented: async () => {
    console.log(`\n${colors.cyan}=== Known Not Implemented Methods ===${colors.reset}`);

    const notImplMethods = [
      'eth_createAccessList',
      'trace_call',
      'trace_callMany',
      'trace_transaction',
      'admin_addPeer',
      'admin_nodeInfo'
    ];

    for (const method of notImplMethods) {
      const result = await rpcCall(method, []);
      logTest(method, result.success ? 'FAIL' : 'NOT_IMPL',
        'Expected to be not implemented');
    }
  }
};

// WebSocket tests
async function testWebSocket() {
  console.log(`\n${colors.cyan}=== WebSocket Tests ===${colors.reset}`);

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let subscriptionId = null;

    ws.on('open', () => {
      console.log('WebSocket connected');

      // Test eth_subscribe
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_subscribe',
        params: ['newHeads'],
        id: 1
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data);

      if (response.id === 1) {
        // Subscription response
        if (response.result) {
          subscriptionId = response.result;
          logTest('eth_subscribe', 'PASS', `Subscription ID: ${subscriptionId}`);

          // Test eth_unsubscribe
          setTimeout(() => {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_unsubscribe',
              params: [subscriptionId],
              id: 2
            }));
          }, 2000);
        } else {
          logTest('eth_subscribe', 'FAIL', response.error?.message);
          ws.close();
          resolve();
        }
      } else if (response.id === 2) {
        // Unsubscribe response
        logTest('eth_unsubscribe', response.result ? 'PASS' : 'FAIL');
        ws.close();
        resolve();
      } else if (response.method === 'eth_subscription') {
        // Subscription notification
        console.log(`${colors.gray}Received subscription notification${colors.reset}`);
      }
    });

    ws.on('error', (err) => {
      logTest('WebSocket Connection', 'FAIL', err.message);
      resolve();
    });

    ws.on('close', () => {
      console.log('WebSocket closed');
      resolve();
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      ws.close();
      resolve();
    }, 5000);
  });
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}═══════════════════════════════════════════════`);
  console.log(`    Cosmos EVM JSON-RPC Comprehensive Test`);
  console.log(`    RPC URL: ${RPC_URL}`);
  console.log(`    WS URL:  ${WS_URL}`);
  console.log(`═══════════════════════════════════════════════${colors.reset}`);

  // Check if node is accessible
  const health = await rpcCall('web3_clientVersion');
  if (!health.success) {
    console.error(`${colors.red}ERROR: Cannot connect to node at ${RPC_URL}${colors.reset}`);
    console.error('Make sure your node is running and JSON-RPC is enabled.');
    process.exit(1);
  }

  // Run all test categories
  for (const [category, testFn] of Object.entries(tests)) {
    try {
      await testFn();
    } catch (err) {
      console.error(`${colors.red}Error in ${category}: ${err.message}${colors.reset}`);
    }
  }

  // Run WebSocket tests
  try {
    await testWebSocket();
  } catch (err) {
    console.error(`${colors.red}WebSocket test error: ${err.message}${colors.reset}`);
  }

  // Print summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════`);
  console.log(`                   TEST SUMMARY`);
  console.log(`═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}Passed:         ${results.passed.length}${colors.reset}`);
  console.log(`${colors.red}Failed:         ${results.failed.length}${colors.reset}`);
  console.log(`${colors.yellow}Not Implemented:${results.notImplemented.length}${colors.reset}`);
  console.log(`${colors.gray}Skipped:        ${results.skipped.length}${colors.reset}`);
  console.log(`${colors.cyan}Total:          ${results.passed.length + results.failed.length + results.notImplemented.length + results.skipped.length}${colors.reset}`);

  if (results.failed.length > 0) {
    console.log(`\n${colors.red}Failed Methods:${colors.reset}`);
    results.failed.forEach(({ method, message }) => {
      console.log(`  - ${method}: ${message}`);
    });
  }
}

// Check dependencies
try {
  require('axios');
  require('ws');
  require('ethers');
} catch (err) {
  console.error(`${colors.red}Missing dependencies. Please run:${colors.reset}`);
  console.error('npm install axios ws ethers');
  process.exit(1);
}

// Run tests
runTests().catch(console.error);