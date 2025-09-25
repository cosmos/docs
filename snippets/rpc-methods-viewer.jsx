import { CosmosIcon } from '/snippets/icons.jsx';

export default function RPCMethodsViewerVersionB() {
  const [theme, setTheme] = useState('dark');

  // Detect theme changes
  useEffect(() => {
    const detectTheme = () => {
      // Mintlify uses 'dark' class on html element for dark mode
      // When in light mode, the 'dark' class is absent
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };

    detectTheme();

    // Listen for theme changes
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', detectTheme);

    return () => {
      observer.disconnect();
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', detectTheme);
    };
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Theme-aware namespace colors - carefully chosen to be distinct
  const namespaceColors = theme === 'dark' ? {
    eth: '#3b82f6',     // Blue (primary namespace)
    web3: '#a855f7',    // Purple
    net: '#10b981',     // Emerald
    txpool: '#22c55e',  // Green
    personal: '#ef4444', // Red
    debug: '#f59e0b',   // Amber/Gold
    admin: '#ec4899',   // Pink
    miner: '#84cc16',   // Lime (high visibility)
    engine: '#f97316',  // Orange
    clique: '#14b8a6',  // Teal
    les: '#06b6d4'      // Cyan
  } : {
    eth: '#3b82f6',     // Blue
    web3: '#9333ea',    // Purple
    net: '#0891b2',     // Cyan
    txpool: '#22c55e',  // Green
    personal: '#ef4444', // Red
    debug: '#f59e0b',   // Amber
    admin: '#ec4899',   // Pink
    miner: '#84cc16',   // Lime
    engine: '#f97316',  // Orange
    clique: '#14b8a6',  // Teal
    les: '#22d3ee'      // Light Cyan
  };

  // Simple code display component
  const CodeHighlighter = ({ code, language, className = '', theme }) => {
    return (
      <pre className={`p-4 rounded-lg text-xs overflow-x-auto border ${className} ${
        theme === 'dark'
          ? 'bg-black border-zinc-800'
          : 'bg-gray-900 border-gray-700'
      }`}>
        <code className="text-zinc-300 font-mono leading-relaxed">
          {code}
        </code>
      </pre>
    );
  };

  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('curl');
  const [rpcEndpoint, setRpcEndpoint] = useState('http://localhost:8545');
  const [isValidEndpoint, setIsValidEndpoint] = useState(false);
  const [isInvalidEndpoint, setIsInvalidEndpoint] = useState(false);
  const [requestResult, setRequestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState('list');
  const [paramValues, setParamValues] = useState({});
  const [debouncedParamValues, setDebouncedParamValues] = useState({});
  const [showAllMethods, setShowAllMethods] = useState(false); // Default to showing only functional methods

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debounce param values to prevent code regeneration on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedParamValues(paramValues);
    }, 300);
    return () => clearTimeout(timer);
  }, [paramValues]);

  const languages = [
    { id: 'curl', name: 'cURL' },
    { id: 'javascript', name: 'JavaScript' },
    { id: 'python', name: 'Python' },
    { id: 'go', name: 'Go' },
    { id: 'rust', name: 'Rust' },
    { id: 'csharp', name: 'C#' }
  ];

  // RPC Methods Data - Generated from unified test results (202 methods total)
  const rpcMethodsData = {
    eth: {
      name: "eth",
      methods: [
        { name: "eth_accounts", status: "Y", description: "Returns list of addresses owned by client" },
        { name: "eth_getBalance", status: "Y", description: "Returns the balance of an account" },
        { name: "eth_getTransactionCount", status: "Y", description: "Returns the number of transactions sent from an address" },
        { name: "eth_blockNumber", status: "Y", description: "Returns the current block number" },
        { name: "eth_chainId", status: "Y", description: "Returns the chain ID" },
        { name: "eth_protocolVersion", status: "Y", description: "Returns the current Ethereum protocol version" },
        { name: "eth_gasPrice", status: "Stub", description: "Returns the current gas price (always 0x0)" },
        { name: "eth_coinbase", status: "Y", description: "Returns the client coinbase address (deprecated in geth)" },
        { name: "eth_maxPriorityFeePerGas", status: "Stub", description: "Returns the max priority fee per gas (always 0x0)" },
        { name: "eth_getBlockByNumber", status: "Y", description: "Returns block information by number" },
        { name: "eth_getBlockByHash", status: "Y", description: "Returns block information by hash" },
        { name: "eth_call", status: "Stub", description: "Executes a message call immediately (returns 0x)" },
        { name: "eth_estimateGas", status: "Y", description: "Estimates gas needed for a transaction" },
        { name: "eth_sign", status: "Y", description: "Signs data with a given address" },
        { name: "eth_feeHistory", status: "Y", description: "Returns fee history" },
        { name: "eth_newFilter", status: "Y", description: "Creates a filter object" },
        { name: "eth_newBlockFilter", status: "Y", description: "Creates a filter for new blocks" },
        { name: "eth_newPendingTransactionFilter", status: "Y", description: "Creates a filter for pending transactions" },
        { name: "eth_uninstallFilter", status: "Y", description: "Uninstalls a filter" },
        // Additional functional transaction methods
        { name: "eth_sendTransaction", status: "N", description: "Sends transaction (not implemented)" },
        { name: "eth_sendRawTransaction", status: "Y", description: "Sends signed raw transaction" },
        { name: "eth_signTransaction", status: "N", description: "Signs transaction (not implemented)" },
        { name: "eth_getTransactionByHash", status: "Stub", description: "Returns transaction by hash (returns null)" },
        { name: "eth_getTransactionReceipt", status: "Stub", description: "Returns transaction receipt (returns null)" },
        { name: "eth_getTransactionByBlockNumberAndIndex", status: "Stub", description: "Returns transaction by block and index (returns null)" },
        { name: "eth_getTransactionByBlockHashAndIndex", status: "Stub", description: "Returns transaction by block hash and index (returns null)" },
        { name: "eth_getLogs", status: "Stub", description: "Returns logs matching filter (returns empty array)" },
        { name: "eth_getStorageAt", status: "Y", description: "Returns storage value at position" },
        { name: "eth_getCode", status: "Stub", description: "Returns code at address (returns 0x)" },
        // Partial/Limited implementations
        { name: "eth_getFilterChanges", status: "Stub", description: "Returns filter changes (limited)" },
        { name: "eth_getFilterLogs", status: "Stub", description: "Returns filter logs (limited)" },
        { name: "eth_getProof", status: "Y", description: "Returns merkle proof for account and storage values" },
        { name: "eth_pendingTransactions", status: "Stub", description: "Returns pending transactions (returns undefined)" },
        { name: "eth_getPendingTransactions", status: "Y", description: "Returns pending transactions (deprecated in geth)" },
        { name: "eth_getBlockTransactionCountByNumber", status: "Stub", description: "Returns transaction count in block (returns 0x0)" },
        { name: "eth_getBlockTransactionCountByHash", status: "Stub", description: "Returns transaction count in block by hash (returns 0x0)" },
        { name: "eth_getBlockReceipts", status: "Stub", description: "Returns all receipts for a block (returns empty array)" },
        { name: "eth_getUncleByBlockNumberAndIndex", status: "Stub", description: "Returns uncle by block number (always null)" },
        { name: "eth_getUncleByBlockHashAndIndex", status: "Stub", description: "Returns uncle by block hash (always null)" },
        { name: "eth_getUncleCountByBlockNumber", status: "Stub", description: "Returns uncle count by number (always 0)" },
        { name: "eth_getUncleCountByBlockHash", status: "Stub", description: "Returns uncle count by hash (always 0)" },
        { name: "eth_syncing", status: "Stub", description: "Returns sync status (always false)" },
        // Mining methods - not applicable
        { name: "eth_mining", status: "Y", description: "Returns mining status (deprecated - always false, no PoW)" },
        { name: "eth_hashrate", status: "Y", description: "Returns hashrate (deprecated - always 0, no PoW)" },
        { name: "eth_getWork", status: "Stub", description: "Returns work array (not applicable)" },
        { name: "eth_submitWork", status: "Stub", description: "Submits work (not applicable)" },
        { name: "eth_submitHashrate", status: "Stub", description: "Submits hashrate (not applicable)" },
        { name: "eth_getTransactionLogs", status: "Stub", description: "Returns transaction logs (Cosmos-specific)" },
        // Additional methods not previously listed
        { name: "eth_getRawTransactionByHash", status: "Stub", description: "Returns raw transaction by hash" },
        { name: "eth_getRawTransactionByBlockNumberAndIndex", status: "Stub", description: "Returns raw transaction by block and index" },
        { name: "eth_getRawTransactionByBlockHashAndIndex", status: "Stub", description: "Returns raw transaction by block hash and index" },
        { name: "eth_resend", status: "N", description: "Resends transaction with new gas price (requires nonce param)" },
        { name: "eth_fillTransaction", status: "N", description: "Fills missing transaction fields (not implemented)" },
        { name: "eth_createAccessList", status: "Y", description: "Creates EIP-2930 access list for transactions" },
        { name: "eth_blobBaseFee", status: "N", description: "Returns blob base fee (EIP-4844 - not implemented)" },
        { name: "eth_getHeaderByHash", status: "Y", description: "Returns block header by hash" },
        { name: "eth_getHeaderByNumber", status: "Y", description: "Returns block header by number" },
        { name: "eth_simulateV1", status: "N", description: "Simulates arbitrary number of transactions (geth-specific, not implemented)" },
        { name: "eth_signTypedData", status: "N", description: "Signs typed structured data (requires domain param)" },
        { name: "eth_signTypedData_v3", status: "N", description: "Signs typed structured data v3 (not implemented)" },
        { name: "eth_signTypedData_v4", status: "N", description: "Signs typed structured data v4 (not implemented)" },
        { name: "eth_subscribe", status: "Y", description: "Creates subscription for events (WebSocket only)" },
        { name: "eth_unsubscribe", status: "Y", description: "Cancels subscription (WebSocket only)" },
        { name: "eth_getCompilers", status: "Stub", description: "Returns available compilers" },
        { name: "eth_compileSolidity", status: "Stub", description: "Compiles Solidity code" },
        { name: "eth_compileLLL", status: "Stub", description: "Compiles LLL code" },
        { name: "eth_compileSerpent", status: "Stub", description: "Compiles Serpent code" }
      ]
    },
    web3: {
      name: "web3",
      color: "purple",
      methods: [
        { name: "web3_clientVersion", status: "Y", description: "Returns the current client version" },
        { name: "web3_sha3", status: "Y", description: "Returns Keccak-256 hash of the given data" }
      ]
    },
    net: {
      name: "net",
      color: "green",
      methods: [
        { name: "net_version", status: "Y", description: "Returns the current network ID" },
        { name: "net_listening", status: "Stub", description: "Returns true if client is actively listening (always true)" },
        { name: "net_peerCount", status: "Stub", description: "Returns number of peers (returns 0)" }
      ]
    },
    txpool: {
      name: "txpool",
      color: "orange",
      methods: [
        { name: "txpool_content", status: "Y", description: "Returns the content of the transaction pool" },
        { name: "txpool_contentFrom", status: "Y", description: "Returns transactions from specific address" },
        { name: "txpool_inspect", status: "Y", description: "Returns a summary of the transaction pool" },
        { name: "txpool_status", status: "Stub", description: "Returns the number of pending and queued transactions (returns empty object)" }
      ]
    },
    personal: {
      name: "personal",
      color: "red",
      methods: [
        { name: "personal_listAccounts", status: "Y", description: "Returns list of accounts" },
        { name: "personal_newAccount", status: "Y", description: "Creates new account" },
        { name: "personal_sign", status: "Y", description: "Signs data with account" },
        { name: "personal_unlockAccount", status: "Stub", description: "Unlocks account (always false)" },
        { name: "personal_lockAccount", status: "Stub", description: "Locks account (always false)" },
        { name: "personal_sendTransaction", status: "N", description: "Sends transaction (not implemented)" },
        { name: "personal_signTransaction", status: "N", description: "Signs transaction (not implemented)" },
        { name: "personal_signAndSendTransaction", status: "N", description: "Signs and sends transaction (not implemented)" },
        { name: "personal_ecRecover", status: "N", description: "Recovers address (requires 65-byte signature)" },
        { name: "personal_importRawKey", status: "N", description: "Imports raw key (requires valid hex key)" },
        { name: "personal_listWallets", status: "Stub", description: "Lists wallets (returns null)" },
        { name: "personal_openWallet", status: "N", description: "Opens wallet (not implemented)" },
        { name: "personal_deriveAccount", status: "N", description: "Derives account (not implemented)" },
        { name: "personal_unpair", status: "N", description: "Unpairs device (not implemented)" },
        { name: "personal_initializeWallet", status: "N", description: "Initializes wallet (not implemented)" }
      ]
    },
    debug: {
      name: "debug",
      color: "yellow",
      methods: [
        // Tracing methods
        { name: "debug_traceTransaction", status: "Y", description: "Traces transaction execution" },
        { name: "debug_traceBlock", status: "Y", description: "Traces all transactions in a block" },
        { name: "debug_traceBlockByNumber", status: "Y", description: "Traces all transactions in block by number" },
        { name: "debug_traceBlockByHash", status: "Y", description: "Traces all transactions in block by hash" },
        { name: "debug_traceCall", status: "Y", description: "Traces eth_call execution" },
        { name: "debug_traceChain", status: "N", description: "Traces chain between blocks (not implemented)" },
        { name: "debug_standardTraceBlockToFile", status: "N", description: "Standard trace to file (not implemented)" },
        { name: "debug_standardTraceBadBlockToFile", status: "N", description: "Trace bad block to file (not implemented)" },
        { name: "debug_traceBadBlock", status: "N", description: "Traces bad block (not implemented)" },
        { name: "debug_intermediateRoots", status: "Y", description: "Returns intermediate state roots (returns empty hash)" },
        // Block and state methods
        { name: "debug_getBadBlocks", status: "N", description: "Returns bad blocks (not implemented)" },
        { name: "debug_storageRangeAt", status: "N", description: "Returns storage range at block (not implemented)" },
        { name: "debug_getModifiedAccountsByNumber", status: "N", description: "Modified accounts by block number (not implemented)" },
        { name: "debug_getModifiedAccountsByHash", status: "N", description: "Modified accounts by block hash (not implemented)" },
        { name: "debug_accountRange", status: "N", description: "Returns range of accounts (not implemented)" },
        { name: "debug_getAccessibleState", status: "N", description: "Returns accessible state range (not implemented)" },
        // Raw data methods
        { name: "debug_getRawBlock", status: "N", description: "Returns raw block data (not implemented)" },
        { name: "debug_getRawHeader", status: "N", description: "Returns raw header data (not implemented)" },
        { name: "debug_getRawReceipts", status: "N", description: "Returns raw receipts (not implemented)" },
        { name: "debug_getRawTransaction", status: "N", description: "Returns raw transaction (not implemented)" },
        { name: "debug_getHeaderRlp", status: "N", description: "Returns header RLP (requires uint64 param)" },
        { name: "debug_getBlockRlp", status: "N", description: "Returns block RLP (requires uint64 param)" },
        // Chain management
        { name: "debug_printBlock", status: "Y", description: "Pretty prints block" },
        { name: "debug_setHead", status: "N", description: "Sets current head of chain (not implemented)" },
        { name: "debug_seedHash", status: "N", description: "Returns seed hash (not implemented)" },
        { name: "debug_freezeClient", status: "N", description: "Freezes client (not implemented)" },
        // Database methods
        { name: "debug_chaindbProperty", status: "N", description: "Returns chain database property (not implemented)" },
        { name: "debug_chaindbCompact", status: "N", description: "Compacts chain database (not implemented)" },
        { name: "debug_dbGet", status: "N", description: "Gets value from database (not implemented)" },
        { name: "debug_dbAncient", status: "N", description: "Gets ancient data from database (not implemented)" },
        { name: "debug_dbAncients", status: "N", description: "Gets number of ancient items (not implemented)" },
        // Profiling methods
        { name: "debug_startCPUProfile", status: "Y", description: "Starts CPU profiling" },
        { name: "debug_stopCPUProfile", status: "Y", description: "Stops CPU profiling" },
        { name: "debug_startGoTrace", status: "Y", description: "Starts Go execution trace" },
        { name: "debug_stopGoTrace", status: "Y", description: "Stops Go execution trace" },
        { name: "debug_blockProfile", status: "Y", description: "Writes goroutine blocking profile" },
        { name: "debug_cpuProfile", status: "Y", description: "Writes CPU profile" },
        { name: "debug_goTrace", status: "Y", description: "Writes Go execution trace" },
        { name: "debug_memStats", status: "Y", description: "Returns memory statistics" },
        { name: "debug_gcStats", status: "Y", description: "Returns GC statistics" },
        { name: "debug_freeOSMemory", status: "Y", description: "Forces garbage collection" },
        { name: "debug_setGCPercent", status: "Y", description: "Sets garbage collection percentage" },
        { name: "debug_writeBlockProfile", status: "Y", description: "Writes block profile to file" },
        { name: "debug_writeMemProfile", status: "Y", description: "Writes memory profile to file" },
        { name: "debug_writeMutexProfile", status: "Y", description: "Writes mutex profile to file" },
        { name: "debug_mutexProfile", status: "Y", description: "Returns mutex profile" },
        { name: "debug_setMutexProfileFraction", status: "Y", description: "Sets mutex profile fraction" },
        { name: "debug_getMutexProfileFraction", status: "N", description: "Gets mutex profile fraction (not implemented)" },
        { name: "debug_setBlockProfileRate", status: "Y", description: "Sets block profile rate" },
        // Runtime methods
        { name: "debug_stacks", status: "Y", description: "Returns stack traces" },
        { name: "debug_stacksLimit", status: "N", description: "Returns limited stack traces (not implemented)" },
        { name: "debug_nodeInfo", status: "N", description: "Returns node information (not implemented)" },
        { name: "debug_peers", status: "N", description: "Returns connected peers (not implemented)" },
        { name: "debug_verbosity", status: "N", description: "Sets logging verbosity (not implemented)" },
        { name: "debug_vmodule", status: "N", description: "Sets logging vmodule (not implemented)" },
        { name: "debug_backtraceAt", status: "N", description: "Sets backtrace location (not implemented)" },
        { name: "debug_preimage", status: "N", description: "Returns preimage for hash (not implemented)" }
      ]
    },
    admin: {
      name: "admin",
      color: "indigo",
      methods: [
        { name: "admin_addPeer", status: "N", description: "Adds peer (not implemented)" },
        { name: "admin_removePeer", status: "N", description: "Removes peer (not implemented)" },
        { name: "admin_addTrustedPeer", status: "N", description: "Adds trusted peer (not implemented)" },
        { name: "admin_removeTrustedPeer", status: "N", description: "Removes trusted peer (not implemented)" },
        { name: "admin_nodeInfo", status: "N", description: "Returns node info (not implemented)" },
        { name: "admin_peers", status: "N", description: "Returns peers (not implemented)" },
        { name: "admin_datadir", status: "N", description: "Returns data directory (not implemented)" },
        { name: "admin_startRPC", status: "N", description: "Starts RPC (not implemented)" },
        { name: "admin_stopRPC", status: "N", description: "Stops RPC (not implemented)" },
        { name: "admin_startWS", status: "N", description: "Starts WebSocket (not implemented)" },
        { name: "admin_stopWS", status: "N", description: "Stops WebSocket (not implemented)" },
        { name: "admin_startHTTP", status: "N", description: "Starts HTTP (not implemented)" },
        { name: "admin_stopHTTP", status: "N", description: "Stops HTTP (not implemented)" },
        { name: "admin_exportChain", status: "N", description: "Exports chain (not implemented)" },
        { name: "admin_importChain", status: "N", description: "Imports chain (not implemented)" },
        { name: "admin_sleepBlocks", status: "N", description: "Sleeps blocks (not implemented)" },
        { name: "admin_clearPeerBanList", status: "N", description: "Clears peer ban list (not implemented)" },
        { name: "admin_listPeerBanList", status: "N", description: "Lists peer ban list (not implemented)" }
      ]
    },
    miner: {
      name: "miner",
      color: "gray",
      methods: [
        { name: "miner_start", status: "N", description: "Starts mining (not applicable - uses 'CometBFT')" },
        { name: "miner_stop", status: "N", description: "Stops mining (not applicable - uses 'CometBFT')" },
        { name: "miner_setEtherbase", status: "N", description: "Sets etherbase (not applicable - uses 'CometBFT')" },
        { name: "miner_setExtra", status: "N", description: "Sets extra data (not applicable - uses 'CometBFT')" },
        { name: "miner_setGasPrice", status: "N", description: "Sets gas price (not applicable - uses 'CometBFT')" },
        { name: "miner_setGasLimit", status: "N", description: "Sets gas limit (not applicable - uses 'CometBFT')" },
        { name: "miner_setRecommitInterval", status: "N", description: "Sets recommit interval (not applicable - uses 'CometBFT')" },
        { name: "miner_getHashrate", status: "N", description: "Returns hashrate (not applicable - uses 'CometBFT')" }
      ]
    },
    engine: {
      name: "engine",
      color: "pink",
      methods: [
        { name: "engine_newPayloadV1", status: "N", description: "New payload V1 (not applicable - uses 'CometBFT')" },
        { name: "engine_newPayloadV2", status: "N", description: "New payload V2 (not applicable - uses 'CometBFT')" },
        { name: "engine_newPayloadV3", status: "N", description: "New payload V3 (not applicable - uses 'CometBFT')" },
        { name: "engine_forkchoiceUpdatedV1", status: "N", description: "Fork choice updated V1 (not applicable - uses 'CometBFT')" },
        { name: "engine_forkchoiceUpdatedV2", status: "N", description: "Fork choice updated V2 (not applicable - uses 'CometBFT')" },
        { name: "engine_forkchoiceUpdatedV3", status: "N", description: "Fork choice updated V3 (not applicable - uses 'CometBFT')" },
        { name: "engine_getPayloadV1", status: "N", description: "Get payload V1 (not applicable - uses 'CometBFT')" },
        { name: "engine_getPayloadV2", status: "N", description: "Get payload V2 (not applicable - uses 'CometBFT')" },
        { name: "engine_getPayloadV3", status: "N", description: "Get payload V3 (not applicable - uses 'CometBFT')" },
        { name: "engine_getPayloadBodiesByHashV1", status: "N", description: "Get payload bodies by hash (not applicable - uses 'CometBFT')" },
        { name: "engine_getPayloadBodiesByRangeV1", status: "N", description: "Get payload bodies by range (not applicable - uses 'CometBFT')" },
        { name: "engine_exchangeTransitionConfigurationV1", status: "N", description: "Exchange transition configuration (not applicable - uses 'CometBFT')" },
        { name: "engine_exchangeCapabilities", status: "N", description: "Exchange capabilities (not applicable - uses 'CometBFT')" },
        { name: "engine_getBlobsV1", status: "N", description: "Get blobs V1 (not applicable - uses 'CometBFT')" }
      ]
    },
    clique: {
      name: "clique",
      color: "teal",
      methods: [
        { name: "clique_getSnapshot", status: "N", description: "Get snapshot at block (not applicable - uses 'CometBFT')" },
        { name: "clique_getSnapshotAtHash", status: "N", description: "Get snapshot at hash (not applicable - uses 'CometBFT')" },
        { name: "clique_getSigners", status: "N", description: "Get authorized signers (not applicable - uses 'CometBFT')" },
        { name: "clique_getSignersAtHash", status: "N", description: "Get signers at hash (not applicable - uses 'CometBFT')" },
        { name: "clique_propose", status: "N", description: "Propose new signer (not applicable - uses 'CometBFT')" },
        { name: "clique_discard", status: "N", description: "Discard signer proposal (not applicable - uses 'CometBFT')" },
        { name: "clique_status", status: "N", description: "Get clique status (not applicable - uses 'CometBFT')" },
        { name: "clique_getSigner", status: "N", description: "Get current signer (not applicable - uses 'CometBFT')" }
      ]
    },
    les: {
      name: "les",
      color: "cyan",
      methods: [
        { name: "les_serverInfo", status: "N", description: "Server information (not implemented)" },
        { name: "les_clientInfo", status: "N", description: "Client information (not implemented)" },
        { name: "les_priorityClientInfo", status: "N", description: "Priority client info (not implemented)" },
        { name: "les_addBalance", status: "N", description: "Add balance to client (not implemented)" },
        { name: "les_setClientParams", status: "N", description: "Set client parameters (not implemented)" },
        { name: "les_setDefaultParams", status: "N", description: "Set default parameters (not implemented)" },
        { name: "les_latestCheckpoint", status: "N", description: "Latest checkpoint (not implemented)" },
        { name: "les_getCheckpoint", status: "N", description: "Get checkpoint by index (not implemented)" },
        { name: "les_getCheckpointContractAddress", status: "N", description: "Get checkpoint contract (not implemented)" }
      ]
    }
  };

  // Transform imported data into the expected format
  const namespaces = Object.entries(rpcMethodsData).reduce((acc, [key, value]) => {
    acc[key] = {
      name: value.name,
      methods: value.methods.map(method => ({
        name: method.name,
        description: method.description,
        implemented: method.status === 'Y',
        partial: method.status === 'Stub',
        notImplemented: method.status === 'N',
        status: method.status,
        params: [],
        cosmosSpecific: method.description.includes('Cosmos-specific'),
        private: method.description.includes('Private') || method.description.includes('private')
      }))
    };
    return acc;
  }, {});

  // Add parameter examples for common methods (preserving existing functionality)
  const methodParams = {
    web3_sha3: [{
      name: 'data',
      type: 'string',
      description: 'The data to hash (hex encoded)',
      example: '0x68656c6c6f20776f726c64'
    }],
    eth_getBalance: [
      { name: 'address', type: 'address', description: 'Address to check', example: '0x407d73d8a49eeb85d32cf465507dd71d507100c1' },
      { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
    ],
    eth_getTransactionCount: [
      { name: 'address', type: 'address', description: 'Address', example: '0x407d73d8a49eeb85d32cf465507dd71d507100c1' },
      { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
    ],
    eth_sendRawTransaction: [
      { name: 'data', type: 'hex', description: 'Signed transaction data', example: '0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675' }
    ],
    eth_call: [
      { name: 'callObject', type: 'object', description: 'Call data' },
      { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
    ],
    eth_estimateGas: [
      { name: 'callObject', type: 'object', description: 'Transaction data' }
    ],
    eth_getStorageAt: [
      { name: 'address', type: 'address', description: 'Storage address', example: '0x295a70b2de5e3953354a6a8344e616ed314d7251' },
      { name: 'position', type: 'hex', description: 'Storage position', example: '0x0' },
      { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
    ],
    eth_getCode: [
      { name: 'address', type: 'address', description: 'Contract address', example: '0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b' },
      { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
    ],
    eth_getBlockByNumber: [
      { name: 'block', type: 'string', description: 'Block number or tag', example: '0x1b4' },
      { name: 'fullTx', type: 'boolean', description: 'Return full transactions', example: true }
    ],
    eth_getBlockByHash: [
      { name: 'blockHash', type: 'hash', description: 'Block hash', example: '0xdc0818cf78f21a8e70579cb46a43643f78291264dda342ae31049421c82d21ae' },
      { name: 'fullTx', type: 'boolean', description: 'Return full transactions', example: false }
    ],
    eth_getTransactionByHash: [
      { name: 'txHash', type: 'hash', description: 'Transaction hash', example: '0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b' }
    ],
    eth_getTransactionReceipt: [
      { name: 'txHash', type: 'hash', description: 'Transaction hash', example: '0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238' }
    ],
    eth_getLogs: [
      { name: 'filterOptions', type: 'object', description: 'Filter parameters' }
    ],
    eth_getTransactionLogs: [
      { name: 'txHash', type: 'hash', description: 'Transaction hash', example: '0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b' }
    ],
    personal_newAccount: [
      { name: 'passphrase', type: 'string', description: 'Passphrase for encryption', example: 'This is the passphrase' }
    ],
    personal_unlockAccount: [
      { name: 'address', type: 'address', description: 'Account address to unlock', example: '0x...' },
      { name: 'passphrase', type: 'string', description: 'Account passphrase', example: 'mypassword' },
      { name: 'duration', type: 'number', description: 'Unlock duration in seconds (0 = indefinite)', example: 300 }
    ],
    personal_sign: [
      { name: 'data', type: 'string', description: 'Data to sign', example: '0xdeadbeef' },
      { name: 'address', type: 'address', description: 'Signing account', example: '0x...' },
      { name: 'passphrase', type: 'string', description: 'Account passphrase', example: 'mypassword' }
    ],
    txpool_contentFrom: [
      { name: 'address', type: 'address', description: 'Address to get transactions from', example: '0x1234567890abcdef1234567890abcdef12345678' }
    ],
    eth_createAccessList: [
      { name: 'callObject', type: 'object', description: 'Transaction call object containing at minimum "from" and "to" addresses', example: '{"from": "0x...", "to": "0x...", "data": "0x..."}' },
      { name: 'blockNumber', type: 'string', description: 'Block number or tag ("latest", "earliest", "pending")', example: 'latest' }
    ]
  };

  // Merge params into methods
  Object.keys(namespaces).forEach(ns => {
    namespaces[ns].methods.forEach(method => {
      if (methodParams[method.name]) {
        method.params = methodParams[method.name];
      }
    });
  });

  // Optimized to only generate code for the selected language
  const generateCodeExample = useCallback((method, params = [], language = 'curl') => {
    const endpoint = rpcEndpoint;
    const jsonRpcBody = {
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: params
    };

    // Only generate code for the requested language to avoid unnecessary computation
    if (language === 'javascript') {
      return [
        '// Using Fetch API',
        `const response = await fetch('${endpoint}', {`,
        `  method: 'POST',`,
        `  headers: { 'Content-Type': 'application/json' },`,
        `  body: JSON.stringify({`,
        `    jsonrpc: '2.0',`,
        `    id: 1,`,
        `    method: '${method}',`,
        `    params: ${JSON.stringify(params)}`,
        `  })`,
        `});`,
        `const data = await response.json();`,
        `console.log(data.result);`,
        '',
        '// Using ethers.js v6',
        `import { JsonRpcProvider } from 'ethers';`,
        `const provider = new JsonRpcProvider('${endpoint}');`,
        `const result = await provider.send('${method}', ${JSON.stringify(params)});`,
        `console.log(result);`,
        '',
        '// Using web3.js v4',
        `import { Web3 } from 'web3';`,
        `const web3 = new Web3('${endpoint}');`,
        `const result = await web3.currentProvider.request({`,
        `  method: '${method}',`,
        `  params: ${JSON.stringify(params)}`,
        `});`,
        `console.log(result);`
      ].join('\n');
    }

    if (language === 'python') {
      return [
        '# Using requests library',
        'import requests',
        'import json',
        '',
        `url = "${endpoint}"`,
        `headers = {"Content-Type": "application/json"}`,
        `payload = {`,
        `    "jsonrpc": "2.0",`,
        `    "id": 1,`,
        `    "method": "${method}",`,
        `    "params": ${JSON.stringify(params)}`,
        `}`,
        '',
        `response = requests.post(url, json=payload, headers=headers)`,
        `data = response.json()`,
        `print(data.get('result'))`,
        '',
        '# Using web3.py',
        'from web3 import Web3',
        '',
        `w3 = Web3(Web3.HTTPProvider("${endpoint}"))`,
        `result = w3.provider.make_request("${method}", ${JSON.stringify(params)})`,
        `print(result['result'])`
      ].join('\n');
    }

    if (language === 'go') {
      return [
        'package main',
        '',
        'import (',
        '    "bytes"',
        '    "encoding/json"',
        '    "fmt"',
        '    "net/http"',
        ')',
        '',
        'func main() {',
        '    payload := map[string]interface{}{',
        '        "jsonrpc": "2.0",',
        '        "id":      1,',
        '        "method":  "' + method + '",',
        '        "params":  []interface{}{' + params.map(p => {
          if (typeof p === 'string') return '"' + p + '"';
          return JSON.stringify(p);
        }).join(', ') + '},',
        '    }',
        '',
        '    jsonData, _ := json.Marshal(payload)',
        '    resp, _ := http.Post("' + endpoint + '", "application/json", bytes.NewBuffer(jsonData))',
        '    defer resp.Body.Close()',
        '',
        '    var result map[string]interface{}',
        '    json.NewDecoder(resp.Body).Decode(&result)',
        '    fmt.Printf("Result: %+v\\n", result["result"])',
        '}'
      ].join('\n');
    }

    if (language === 'rust') {
      return `use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "${method}".to_string(),
        params: vec![${params.map(p =>
          typeof p === 'string' ? `json!("${p}")` : `json!(${JSON.stringify(p)})`
        ).join(', ')}],
    };

    let response = client
        .post("${endpoint}")
        .json(&request)
        .send()
        .await?
        .json::<JsonRpcResponse>()
        .await?;

    match response.error {
        Some(error) => eprintln!("Error {}: {}", error.code, error.message),
        None => println!("Result: {:#?}", response.result),
    }

    Ok(())
}

// Cargo.toml dependencies:
// [dependencies]
// reqwest = { version = "0.11", features = ["json"] }
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"
// tokio = { version = "1", features = ["full"] }`;
    }

    if (language === 'csharp') {
      return `using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

public class JsonRpcRequest
{
    [JsonPropertyName("jsonrpc")]
    public string JsonRpc { get; set; } = "2.0";

    [JsonPropertyName("id")]
    public int Id { get; set; } = 1;

    [JsonPropertyName("method")]
    public string Method { get; set; }

    [JsonPropertyName("params")]
    public object[] Params { get; set; }
}

public class JsonRpcResponse<T>
{
    [JsonPropertyName("jsonrpc")]
    public string JsonRpc { get; set; }

    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("result")]
    public T Result { get; set; }

    [JsonPropertyName("error")]
    public JsonRpcError Error { get; set; }
}

public class JsonRpcError
{
    [JsonPropertyName("code")]
    public int Code { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; }
}

class Program
{
    static async Task Main(string[] args)
    {
        using var httpClient = new HttpClient();

        var request = new JsonRpcRequest
        {
            Method = "${method}",
            Params = new object[] { ${params.map(p =>
              typeof p === 'string' ? `"${p}"` : JSON.stringify(p)
            ).join(', ')} }
        };

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await httpClient.PostAsync("${endpoint}", content);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonRpcResponse<JsonElement>>(responseBody);

            if (jsonResponse?.Error != null)
            {
                Console.Error.WriteLine($"Error {jsonResponse.Error.Code}: {jsonResponse.Error.Message}");
            }
            else
            {
                Console.WriteLine($"Result: {jsonResponse?.Result}");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Request failed: {ex.Message}");
        }
    }
}`;
    }

    // Default to curl
    return `curl -X POST ${endpoint} \\\n` +
      `  -H "Content-Type: application/json" \\\n` +
      `  -d '${JSON.stringify(jsonRpcBody, null, 2)}'`;
  }, [rpcEndpoint]);

  const executeRpcRequest = async () => {
    if (!selectedMethod) return;

    setIsLoading(true);
    setRequestResult(null);

    // Build params from form values
    const params = selectedMethod.params.map(param =>
      paramValues[param.name] || param.example || ''
    );

    try {
      const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: selectedMethod.name,
          params: params
        })
      });

      const data = await response.json();
      setRequestResult(data);
    } catch (error) {
      setRequestResult({
        error: {
          message: error.message,
          code: -1
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateEndpoint = async () => {
    try {
      const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'web3_clientVersion',
          params: []
        })
      });
      setIsValidEndpoint(response.ok);
      setIsInvalidEndpoint(!response.ok);
    } catch {
      setIsValidEndpoint(false);
      setIsInvalidEndpoint(true);
    }
  };

  useEffect(() => {
    validateEndpoint();
  }, []);

  const allMethods = useMemo(() => {
    const methods = [];
    Object.entries(namespaces).forEach(([key, namespace]) => {
      namespace.methods.forEach(method => {
        methods.push({
          ...method,
          namespace: key,
          namespaceName: namespace.name
        });
      });
    });
    return methods;
  }, [namespaces]);

  const filteredMethods = useMemo(() => {
    let methods = allMethods;

    if (searchTerm) {
      methods = methods.filter(method =>
        method.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        method.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedNamespace !== 'all') {
      methods = methods.filter(method => method.namespace === selectedNamespace);
    }

    if (!showAllMethods) {
      methods = methods.filter(method => method.status === 'Y');
    }

    return methods;
  }, [selectedNamespace, searchTerm, allMethods, showAllMethods]);

  // Compute which namespaces have visible methods
  const visibleNamespaces = useMemo(() => {
    const visible = new Set();
    allMethods.forEach(method => {
      if (showAllMethods || method.status === 'Y') {
        visible.add(method.namespace);
      }
    });
    return visible;
  }, [allMethods, showAllMethods]);

  // Generate code example using debounced values
  const codeExample = useMemo(() => {
    if (!selectedMethod) return '';
    const params = selectedMethod.params.map(p => debouncedParamValues[p.name] || p.example || '');
    return generateCodeExample(selectedMethod.name, params, selectedLanguage);
  }, [selectedMethod, debouncedParamValues, selectedLanguage, generateCodeExample]);

  return (
    <div className={`min-h-[600px] h-[80vh] not-prose flex flex-col relative ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full p-4">
      {/* Header */}
      <div className={`rounded-t-lg px-6 py-4 flex-shrink-0 ${
        theme === 'dark'
          ? 'bg-black border-b border-zinc-800'
          : 'bg-white border-b border-gray-200'
      }`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Ethereum JSON-RPC Explorer</h1>
            <p className={`text-sm mt-1 ${
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            }`}>
              Interactive method testing for Cosmos EVM
            </p>
          </div>

          {/* RPC Endpoint Config */}
          <div className={`${isMobile ? 'w-full' : 'w-[40%] max-w-md'}`}>
            <div className="flex flex-col gap-1">
              <label className={`text-xs ${
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              }`}>RPC URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="http://localhost:8545"
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark'
                    ? 'bg-zinc-800 text-white border-zinc-700'
                    : 'bg-white text-gray-900 border-gray-300'
                }`}
                  value={rpcEndpoint}
                  onChange={(e) => {
                    setRpcEndpoint(e.target.value);
                    setIsValidEndpoint(false);
                    setIsInvalidEndpoint(false);
                  }}
                  onBlur={validateEndpoint}
                />
                {isValidEndpoint && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Connected
                  </span>
                )}
                {isInvalidEndpoint && (
                  <span className="text-xs text-red-500">Failed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden rounded-b-lg">
        {/* Left Panel - Methods List */}
        <div className={`${isMobile ? 'w-full' : 'w-80'} ${
          isMobile && showMobilePanel !== 'list' ? 'hidden' : ''
        } flex flex-col h-full overflow-hidden ${
          theme === 'dark'
            ? 'border-r border-zinc-800 bg-black'
            : 'border-r border-gray-200 bg-white'
        }`}>
          {/* Search & Filters */}
          <div className={`p-4 ${
            theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-gray-200'
          }`}>
            <div className="relative">
              <svg className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search methods..."
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1 mt-3">
              <button
                onClick={() => setSelectedNamespace('all')}
                style={{
                  boxShadow: selectedNamespace === 'all'
                    ? `0 0 0 2px ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`
                    : 'none'
                }}
                className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
                  selectedNamespace === 'all'
                    ? theme === 'dark'
                      ? 'bg-zinc-500 text-white'
                      : 'bg-gray-500 text-white'
                    : theme === 'dark'
                      ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                All
              </button>
              {Object.entries(namespaces)
                .filter(([key]) => visibleNamespaces.has(key))
                .map(([key, namespace]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedNamespace(key)}
                    style={{
                      backgroundColor: theme === 'dark'
                        ? (selectedNamespace === key ? namespaceColors[key] : 'transparent')
                        : namespaceColors[key],
                      borderColor: namespaceColors[key],
                      borderWidth: '2px',
                      color: 'white', // Always white text for better visibility
                      opacity: theme === 'light' ? (selectedNamespace === key ? 1 : 0.7) : 1,
                      boxShadow: selectedNamespace === key
                        ? `0 0 0 2px ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`
                        : 'none'
                    }}
                    className="px-3 py-1 text-xs rounded-full transition-all font-medium hover:opacity-100"
                  >
                    {namespace.name}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <label className="flex items-center cursor-pointer text-xs gap-2">
                <input
                  type="checkbox"
                  checked={showAllMethods}
                  onChange={(e) => setShowAllMethods(e.target.checked)}
                  className="mr-2"                />
                <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>
                  Show all methods (including unsupported)
                </span>
              </label>
            </div>
          </div>

          {/* Methods */}
          <div className="flex-1 overflow-y-auto">
            {filteredMethods.map((method) => (
              <button
                key={method.name}
                onClick={() => {
                  setSelectedMethod(method);
                  setParamValues({});
                  setRequestResult(null);
                  if (isMobile) setShowMobilePanel('details');
                }}
                className={`w-full px-4 py-3 text-left transition-colors ${
                  selectedMethod?.name === method.name
                    ? theme === 'dark' ? 'bg-zinc-800/50' : 'bg-gray-100'
                    : ''
                } ${
                  theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50'
                }`}
                style={{
                  borderLeft: `3px solid ${namespaceColors[method.namespace]}`,
                  borderTop: `1px solid ${namespaceColors[method.namespace]}33`,
                  borderRight: `1px solid ${namespaceColors[method.namespace]}33`,
                  borderBottom: `1px solid ${namespaceColors[method.namespace]}33`,
                  borderRadius: '0 4px 4px 0',
                  marginBottom: '2px'
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-blue-400 truncate">
                        {method.name}
                      </code>
                      {method.status === 'Stub' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/30 text-yellow-400">
                          stub
                        </span>
                      )}
                      {method.status === 'N' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-400">
                          not impl
                        </span>
                      )}
                      {method.cosmosSpecific && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/30">
                          <CosmosIcon size={10} color={theme === 'dark' ? '#c084fc' : '#9333ea'} />
                          <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}>Cosmos</span>
                        </span>
                      )}
                      {method.private && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          theme === 'dark'
                            ? 'bg-amber-500/30 text-amber-400'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          Private
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 line-clamp-2 ${
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'
                    }`}>
                      {method.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center Panel - Method Details */}
        <div className={`${
          isMobile && showMobilePanel !== 'details' ? 'hidden' : ''
        } flex-1 flex flex-col overflow-y-auto ${
          theme === 'dark' ? 'bg-black' : 'bg-white'
        }`}>
          {selectedMethod ? (
            <>
              <div className={`p-6 ${
                theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-gray-200'
              }`}>
                <div className="flex items-center">
                  <h2 className={`text-2xl font-mono font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedMethod.name}
                  </h2>
                  <div
                    className="flex-1 ml-4 h-0.5"
                    style={{ backgroundColor: namespaceColors[selectedMethod.namespace] }}
                  />
                </div>
                <p className={`mt-1 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                }`}>
                  {selectedMethod.description}
                </p>

                {/* Status Legend */}
                <div className={`mt-4 flex flex-wrap gap-3 text-xs ${
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                }`}>
                  {selectedMethod.status === 'Stub' && (
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500/30 text-yellow-400 text-[10px]">stub</span>
                      <span>Returns empty/null for compatibility</span>
                    </div>
                  )}
                  {selectedMethod.status === 'N' && (
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-400 text-[10px]">not impl</span>
                      <span>Not implemented in Cosmos EVM</span>
                    </div>
                  )}
                  {selectedMethod.cosmosSpecific && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/30 text-[10px]">
                        <CosmosIcon size={10} color={theme === 'dark' ? '#c084fc' : '#9333ea'} />
                        <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}>Cosmos</span>
                      </span>
                      <span>Cosmos-specific extension</span>
                    </div>
                  )}
                  {selectedMethod.private && (
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        theme === 'dark'
                          ? 'bg-amber-500/30 text-amber-400'
                          : 'bg-amber-100 text-amber-700'
                      }`}>Private</span>
                      <span>Requires authentication</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Parameters */}
              {selectedMethod.params && selectedMethod.params.length > 0 && (
                <div className={`p-6 ${
                  theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-gray-200'
                }`}>
                  <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Parameters
                  </h3>
                  <div className="space-y-3">
                    {selectedMethod.params.map((param, i) => (
                      <div key={i} className={`rounded-lg p-4 ${
                    theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
                  }`}>
                        <code className="text-sm font-mono text-blue-400">
                          {param.name}
                        </code>
                        <span className={`ml-2 text-xs px-2 py-1 rounded ${
                          theme === 'dark'
                            ? 'bg-zinc-700 text-zinc-300'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {param.type}
                        </span>
                        <p className={`mt-2 text-sm ${
                          theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                        }`}>
                          {param.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            }`}>
              <p>Select a method to view details</p>
            </div>
          )}
        </div>

        {/* Right Panel - Interactive Execute */}
        <div className={`${
          isMobile ? 'w-full' : 'w-96'
        } ${
          isMobile && showMobilePanel !== 'execute' ? 'hidden' : ''
        } flex flex-col h-full overflow-hidden ${
          theme === 'dark'
            ? 'border-l border-zinc-800 bg-black'
            : 'border-l border-gray-200 bg-white'
        }`}>
          {selectedMethod ? (
            <div className="flex-1 overflow-y-auto">
              {/* Parameters Form */}
              {selectedMethod.params && selectedMethod.params.length > 0 && (
                <div className={`p-4 ${
                  theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-gray-200'
                }`}>
                  <h3 className={`text-sm font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Parameters</h3>
                  <div className="space-y-3">
                    {selectedMethod.params.map((param) => (
                      <div key={param.name}>
                        <label className={`text-xs block mb-1 ${
                          theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                        }`}>
                          {param.name} ({param.type})
                        </label>
                        <input
                          type="text"
                          placeholder={param.example || `Enter ${param.name}`}
                          className={`w-full px-3 py-2 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            theme === 'dark'
                              ? 'bg-zinc-800 text-white border-zinc-700'
                              : 'bg-gray-100 text-gray-900 border-gray-300'
                          }`}
                          value={paramValues[param.name] || ''}
                          onChange={(e) => setParamValues(prev => ({
                            ...prev,
                            [param.name]: e.target.value
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <div className={`p-4 ${
                theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-gray-200'
              }`}>
                <button
                  onClick={executeRpcRequest}
                  disabled={isLoading || !isValidEndpoint}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isLoading ? 'Executing...' : 'Execute Request'}
                </button>
              </div>

              {/* Code Examples */}
              <div className={`p-4 ${
                theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Code Example</h3>
                  <button
                    onClick={() => handleCopy(codeExample)}
                    className={`p-1 ${
                      theme === 'dark'
                        ? 'text-zinc-400 hover:text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                {/* Language Tabs */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {languages.map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => setSelectedLanguage(lang.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedLanguage === lang.id
                          ? 'bg-blue-600 text-white'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>

                <CodeHighlighter
                  code={codeExample}
                  language={selectedLanguage}
                  theme={theme}
                />
              </div>

              {/* Response */}
              {requestResult && (
                <div className="p-4">
                  <h3 className={`text-sm font-semibold mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Response</h3>
                  <CodeHighlighter
                    code={JSON.stringify(requestResult, null, 2)}
                    language="json"
                    theme={theme}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            }`}>
              <p>Select a method to execute</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobile && (
        <div className={`border-t flex-shrink-0 ${
          theme === 'dark' ? 'border-zinc-800 bg-black' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex">
            <button
              onClick={() => setShowMobilePanel('list')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                showMobilePanel === 'list'
                  ? theme === 'dark' ? 'text-blue-400 bg-zinc-800/50' : 'text-blue-600 bg-gray-100'
                  : theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              }`}
            >
              Methods
            </button>
            <button
              onClick={() => setShowMobilePanel('details')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                showMobilePanel === 'details'
                  ? theme === 'dark' ? 'text-blue-400 bg-zinc-800/50' : 'text-blue-600 bg-gray-100'
                  : theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              }`}
              disabled={!selectedMethod}
            >
              Details
            </button>
            <button
              onClick={() => setShowMobilePanel('execute')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                showMobilePanel === 'execute'
                  ? theme === 'dark' ? 'text-blue-400 bg-zinc-800/50' : 'text-blue-600 bg-gray-100'
                  : theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              }`}
              disabled={!selectedMethod}
            >
              Execute
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}