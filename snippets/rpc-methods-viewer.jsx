import { CurlIcon, TypeScriptIcon, GoIcon, RustIcon, PythonIcon, CSharpIcon, APIIcon, NetworkIcon, EthereumIcon, SmartContractIcon } from '/snippets/icons.mdx';

export default function RPCMethodsViewer() {
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMethods, setExpandedMethods] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState({});
  const [rpcEndpoint, setRpcEndpoint] = useState('');
  const [isValidEndpoint, setIsValidEndpoint] = useState(false);
  const [isInvalidEndpoint, setIsInvalidEndpoint] = useState(false);
  const [requestResults, setRequestResults] = useState({});
  const [isLoading, setIsLoading] = useState({});

  const languages = [
    { id: 'curl', name: 'cURL', icon: CurlIcon },
    { id: 'typescript', name: 'TypeScript', icon: TypeScriptIcon },
    { id: 'go', name: 'Go', icon: GoIcon },
    { id: 'rust', name: 'Rust', icon: RustIcon },
    { id: 'python', name: 'Python', icon: PythonIcon },
    { id: 'csharp', name: 'C#', icon: CSharpIcon }
  ];

  const generateCodeExamples = (method, params = []) => {
    const endpoint = 'http://localhost:8545';
    const paramValues = params.length > 0 ? params : [];

    return {
      curl: `curl -X POST -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "${method}",
    "params": ${JSON.stringify(paramValues, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n')}
  }' \\
  ${endpoint}`,

      typescript: `import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('${endpoint}');

// Using ethers.js
const result = await provider.send('${method}', ${JSON.stringify(paramValues)});
console.log(result);

// Using fetch
const response = await fetch('${endpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: '${method}',
    params: ${JSON.stringify(paramValues)}
  })
});
const data = await response.json();
console.log(data.result);`,

      go: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

type JSONRPCRequest struct {
    JSONRPC string        \`json:"jsonrpc"\`
    ID      int           \`json:"id"\`
    Method  string        \`json:"method"\`
    Params  []interface{} \`json:"params"\`
}

func main() {
    request := JSONRPCRequest{
        JSONRPC: "2.0",
        ID:      1,
        Method:  "${method}",
        Params:  []interface{}{${paramValues.map(p => typeof p === 'string' ? `"${p}"` : p).join(', ')}},
    }

    jsonData, _ := json.Marshal(request)
    resp, err := http.Post("${endpoint}", "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}`,

      rust: `use serde_json::json;
use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .post("${endpoint}")
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "${method}",
            "params": ${JSON.stringify(paramValues)}
        }))
        .send()
        .await?;

    let result = response.json::<serde_json::Value>().await?;
    println!("{:#?}", result);

    Ok(())
}`,

      python: `import requests
import json

# Using requests library
payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "${method}",
    "params": ${JSON.stringify(paramValues)}
}

response = requests.post("${endpoint}", json=payload)
result = response.json()
print(result)

# Using web3.py (if applicable)
from web3 import Web3
w3 = Web3(Web3.HTTPProvider("${endpoint}"))
result = w3.provider.make_request("${method}", ${JSON.stringify(paramValues)})
print(result)`,

      csharp: `using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        var rpcUrl = "${endpoint}";

        var requestObj = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "${method}",
            @params = ${JSON.stringify(paramValues)}
        };

        var jsonBody = JsonSerializer.Serialize(requestObj);
        using var http = new HttpClient();
        using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

        try
        {
            var response = await http.PostAsync(rpcUrl, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Console.Error.WriteLine($"HTTP {(int)response.StatusCode}: {responseBody}");
                return;
            }

            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (root.TryGetProperty("error", out var error))
            {
                Console.Error.WriteLine($"RPC Error: {error}");
            }
            else if (root.TryGetProperty("result", out var result))
            {
                Console.WriteLine(result.ToString());
            }
            else
            {
                Console.Error.WriteLine("Unexpected RPC response format.");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Request failed: {ex.Message}");
        }
    }
}`
    };
  };

  const namespaces = {
    web3: {
      name: 'Web3',
      icon: APIIcon,
      methods: [
        {
          name: 'web3_clientVersion',
          description: 'Get the web3 client version',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Standard Request',
              params: [],
              response: {
                result: 'Cosmos/0.1.3+/linux/go1.18'
              }
            }
          ]
        },
        {
          name: 'web3_sha3',
          description: 'Returns Keccak-256 hash of the given data',
          implemented: true,
          params: [{ name: 'data', type: 'string', description: 'The data to hash (hex encoded)', example: '0x68656c6c6f20776f726c64' }],
          examples: [
            {
              name: 'Hash "hello world"',
              params: ['0x68656c6c6f20776f726c64'],
              response: {
                result: '0x1b84adea42d5b7d192fd8a61a85b25abe0757e9a65cab1da470258914053823f'
              }
            },
            {
              name: 'Hash empty string',
              params: ['0x'],
              response: {
                result: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
              }
            }
          ]
        }
      ]
    },
    net: {
      name: 'Net',
      icon: NetworkIcon,
      methods: [
        {
          name: 'net_version',
          description: 'Returns the current network id',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get Network ID',
              params: [],
              response: { result: '1' }
            }
          ]
        },
        {
          name: 'net_peerCount',
          description: 'Returns the number of connected peers',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Standard Request',
              params: [],
              response: { result: '0x17' }
            }
          ]
        },
        {
          name: 'net_listening',
          description: 'Check if client is listening for connections',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Node is listening',
              params: [],
              response: { result: true }
            },
            {
              name: 'Node not listening',
              params: [],
              response: { result: false }
            }
          ]
        }
      ]
    },
    eth: {
      name: 'Eth',
      icon: EthereumIcon,
      methods: [
        {
          name: 'eth_blockNumber',
          description: 'Get current block number',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Current Block',
              params: [],
              response: { result: '0x5bad55' }
            }
          ]
        },
        {
          name: 'eth_getBalance',
          description: 'Get account balance',
          implemented: true,
          params: [
            { name: 'address', type: 'address', description: 'The account address', example: '0x407d73d8a49eeb85d32cf465507dd71d507100c1' },
            { name: 'block', type: 'string', description: 'Block number or "latest", "earliest", "pending"', example: 'latest' }
          ],
          examples: [
            {
              name: 'Get balance at latest block',
              params: ['0x407d73d8a49eeb85d32cf465507dd71d507100c1', 'latest'],
              response: { result: '0x0234c8a3397aab58' }
            },
            {
              name: 'Get balance at specific block',
              params: ['0x407d73d8a49eeb85d32cf465507dd71d507100c1', '0x1b4'],
              response: { result: '0x0' }
            }
          ]
        },
        {
          name: 'eth_getTransactionByHash',
          description: 'Get transaction details by hash',
          implemented: true,
          params: [
            { name: 'hash', type: 'hash', description: 'Transaction hash', example: '0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b' }
          ],
          examples: [
            {
              name: 'Existing transaction',
              params: ['0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b'],
              response: {
                result: {
                  blockHash: '0x1d59ff54b1eb26b013ce3cb5fc9dab3705b415a67127a003c3e61eb445bb8df2',
                  blockNumber: '0x5daf3b',
                  from: '0xa7d9ddbe1f17865597fbd27ec712455208b6b76d',
                  gas: '0xc350',
                  gasPrice: '0x4a817c800',
                  hash: '0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b',
                  input: '0x68656c6c6f21',
                  nonce: '0x15',
                  to: '0xf02c1c8e6114b1dbe8937a39260b5b0a374432bb',
                  transactionIndex: '0x41',
                  value: '0xf3dbb76162000',
                  v: '0x25',
                  r: '0x1b5e176d927f8e9ab405058b2d2457392da3e20f328b16ddabcebc33eaac5fea',
                  s: '0x4ba69724e8f69de52f0125ad8b3c5c2cef33019bac3249e2c0a2192766d1721c'
                }
              }
            },
            {
              name: 'Transaction not found',
              params: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
              response: { result: null }
            }
          ]
        },
        {
          name: 'eth_sendRawTransaction',
          description: 'Submit a signed transaction',
          implemented: true,
          params: [
            { name: 'data', type: 'bytes', description: 'Signed transaction data', example: '0xf86c0185046110...' }
          ],
          examples: [
            {
              name: 'Valid transaction',
              params: ['0xf86c01850465...'],
              response: { result: '0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331' }
            },
            {
              name: 'Invalid transaction',
              params: ['0xinvalid'],
              response: {
                error: {
                  code: -32602,
                  message: 'Invalid params'
                }
              }
            }
          ]
        },
        {
          name: 'eth_call',
          description: 'Execute a call without creating a transaction',
          implemented: true,
          params: [
            {
              name: 'transaction',
              type: 'object',
              description: 'Transaction call object',
              fields: [
                { name: 'from', type: 'address', description: 'Address to call from (optional)' },
                { name: 'to', type: 'address', description: 'Contract address' },
                { name: 'gas', type: 'quantity', description: 'Gas limit (optional)' },
                { name: 'gasPrice', type: 'quantity', description: 'Gas price (optional)' },
                { name: 'value', type: 'quantity', description: 'Value to send (optional)' },
                { name: 'data', type: 'bytes', description: 'Call data' }
              ]
            },
            { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
          ],
          examples: [
            {
              name: 'Call balanceOf',
              params: [
                {
                  to: '0x08d68b6d693a685126f823bc7787e4078b3d35e3',
                  data: '0x70a08231000000000000000000000000b60e8dd61c5d32be8058bb8eb970870f07233155'
                },
                'latest'
              ],
              response: { result: '0x00000000000000000000000000000000000000000000000000000000000186a0' }
            }
          ]
        },
        {
          name: 'eth_getLogs',
          description: 'Get logs matching filter criteria',
          implemented: true,
          params: [
            {
              name: 'filter',
              type: 'object',
              description: 'Filter object',
              fields: [
                { name: 'fromBlock', type: 'string', description: 'Starting block' },
                { name: 'toBlock', type: 'string', description: 'Ending block' },
                { name: 'address', type: 'address', description: 'Contract address(es)' },
                { name: 'topics', type: 'array', description: 'Topic filters' }
              ]
            }
          ],
          examples: [
            {
              name: 'Get Transfer events',
              params: [{
                fromBlock: '0x1',
                toBlock: 'latest',
                address: '0xb59f67a8bff5d8cd03f6ac17265c550ed8f33907',
                topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']
              }],
              response: {
                result: [{
                  address: '0xb59f67a8bff5d8cd03f6ac17265c550ed8f33907',
                  topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
                  data: '0x00000000000000000000000000000000000000000000000000000000000186a0',
                  blockNumber: '0x1b4',
                  transactionHash: '0x67....',
                  transactionIndex: '0x0',
                  blockHash: '0x78....',
                  logIndex: '0x0',
                  removed: false
                }]
              }
            }
          ]
        },
        {
          name: 'eth_coinbase',
          description: 'Get the mining rewards recipient address',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get coinbase',
              params: [],
              response: {
                result: '0x7cB61D4117AE31a12E393a1Cfa3BaC666481D02E'
              }
            }
          ]
        },
        {
          name: 'eth_mining',
          description: 'Check if client is actively mining',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Check mining status',
              params: [],
              response: {
                result: false
              }
            }
          ]
        },
        {
          name: 'eth_hashrate',
          description: 'Get current hashrate',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get hashrate',
              params: [],
              response: {
                result: '0x0'
              }
            }
          ]
        },
        {
          name: 'eth_chainId',
          description: 'Get chain ID for replay-protected transactions',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get chain ID',
              params: [],
              response: {
                result: '0x40000'
              }
            }
          ]
        },
        {
          name: 'eth_protocolVersion',
          description: 'Returns the current ethereum protocol version',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get protocol version',
              params: [],
              response: { result: '0x41' }
            }
          ]
        },
        {
          name: 'eth_syncing',
          description: 'Returns sync status or false',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Not syncing',
              params: [],
              response: { result: false }
            },
            {
              name: 'Currently syncing',
              params: [],
              response: {
                result: {
                  startingBlock: '0x384',
                  currentBlock: '0x386',
                  highestBlock: '0x454'
                }
              }
            }
          ]
        },
        {
          name: 'eth_gasPrice',
          description: 'Returns current gas price',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get gas price',
              params: [],
              response: { result: '0x4a817c800' }
            }
          ]
        },
        {
          name: 'eth_accounts',
          description: 'Returns list of addresses owned by client',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get accounts',
              params: [],
              response: { result: ['0x407d73d8a49eeb85d32cf465507dd71d507100c1'] }
            }
          ]
        },
        {
          name: 'eth_getStorageAt',
          description: 'Returns value from a storage position at an address',
          implemented: true,
          params: [
            { name: 'address', type: 'address', description: 'Storage address', example: '0x295a70b2de5e3953354a6a8344e616ed314d7251' },
            { name: 'position', type: 'quantity', description: 'Integer position in storage', example: '0x0' },
            { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
          ],
          examples: [
            {
              name: 'Get storage value',
              params: ['0x295a70b2de5e3953354a6a8344e616ed314d7251', '0x0', 'latest'],
              response: { result: '0x00000000000000000000000000000000000000000000000000000000000004d2' }
            }
          ]
        },
        {
          name: 'eth_getTransactionCount',
          description: 'Returns the number of transactions sent from an address',
          implemented: true,
          params: [
            { name: 'address', type: 'address', description: 'The address', example: '0x407d73d8a49eeb85d32cf465507dd71d507100c1' },
            { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
          ],
          examples: [
            {
              name: 'Get transaction count',
              params: ['0x407d73d8a49eeb85d32cf465507dd71d507100c1', 'latest'],
              response: { result: '0x1' }
            }
          ]
        },
        {
          name: 'eth_getCode',
          description: 'Returns code at a given address',
          implemented: true,
          params: [
            { name: 'address', type: 'address', description: 'The address', example: '0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b' },
            { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
          ],
          examples: [
            {
              name: 'Get contract code',
              params: ['0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b', 'latest'],
              response: { result: '0x600160008035811a818181146012578301005b601b6001356025565b8060005260206000f25b600060078202905091905056' }
            }
          ]
        },
        {
          name: 'eth_estimateGas',
          description: 'Estimates gas needed for a transaction',
          implemented: true,
          params: [
            {
              name: 'transaction',
              type: 'object',
              description: 'Transaction call object',
              fields: [
                { name: 'from', type: 'address', description: 'Address to call from (optional)' },
                { name: 'to', type: 'address', description: 'Contract address' },
                { name: 'gas', type: 'quantity', description: 'Gas limit (optional)' },
                { name: 'gasPrice', type: 'quantity', description: 'Gas price (optional)' },
                { name: 'value', type: 'quantity', description: 'Value to send (optional)' },
                { name: 'data', type: 'bytes', description: 'Call data' }
              ]
            }
          ],
          examples: [
            {
              name: 'Estimate gas',
              params: [{
                from: '0xb60e8dd61c5d32be8058bb8eb970870f07233155',
                to: '0xd46e8dd67c5d32be8058bb8eb970870f07244567',
                value: '0x9184e72a'
              }],
              response: { result: '0x5208' }
            }
          ]
        },
        {
          name: 'eth_getBlockByNumber',
          description: 'Returns block information by number',
          implemented: true,
          params: [
            { name: 'blockNumber', type: 'string', description: 'Block number or tag', example: '0x1b4' },
            { name: 'fullTransactions', type: 'boolean', description: 'Return full transaction objects', example: true }
          ],
          examples: [
            {
              name: 'Get block by number',
              params: ['0x1b4', true],
              response: {
                result: {
                  number: '0x1b4',
                  hash: '0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331',
                  parentHash: '0x9646252be9520f6e71339a8df9c55e4d7619deeb018d2a3f2d21fc165dde5eb5',
                  transactions: []
                }
              }
            }
          ]
        },
        {
          name: 'eth_getBlockByHash',
          description: 'Returns block information by hash',
          implemented: true,
          params: [
            { name: 'blockHash', type: 'hash', description: 'Block hash', example: '0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331' },
            { name: 'fullTransactions', type: 'boolean', description: 'Return full transaction objects', example: true }
          ],
          examples: [
            {
              name: 'Get block by hash',
              params: ['0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331', true],
              response: {
                result: {
                  number: '0x1b4',
                  hash: '0xe670ec64341771606e55d6b4ca35a1a6b75ee3d5145a99d05921026d1527331',
                  parentHash: '0x9646252be9520f6e71339a8df9c55e4d7619deeb018d2a3f2d21fc165dde5eb5',
                  transactions: []
                }
              }
            }
          ]
        },
        {
          name: 'eth_getTransactionReceipt',
          description: 'Returns the receipt of a transaction',
          implemented: true,
          params: [
            { name: 'hash', type: 'hash', description: 'Transaction hash', example: '0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238' }
          ],
          examples: [
            {
              name: 'Get transaction receipt',
              params: ['0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238'],
              response: {
                result: {
                  transactionHash: '0xb903239f8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238',
                  transactionIndex: '0x1',
                  blockNumber: '0xb',
                  blockHash: '0xc6ef2fc5426d6ad6fd9e2a26abeab0aa2411b7ab17f30a99d3cb96aed1d1055b',
                  cumulativeGasUsed: '0x33bc',
                  gasUsed: '0x4dc',
                  contractAddress: null,
                  logs: [],
                  status: '0x1'
                }
              }
            }
          ]
        },
        {
          name: 'eth_newFilter',
          description: 'Creates a filter for logs',
          implemented: true,
          params: [
            {
              name: 'filter',
              type: 'object',
              description: 'Filter options',
              fields: [
                { name: 'fromBlock', type: 'string', description: 'Starting block' },
                { name: 'toBlock', type: 'string', description: 'Ending block' },
                { name: 'address', type: 'address', description: 'Contract address(es)' },
                { name: 'topics', type: 'array', description: 'Topic filters' }
              ]
            }
          ],
          examples: [
            {
              name: 'Create filter',
              params: [{
                fromBlock: '0x1',
                toBlock: 'latest',
                address: '0x8888f1f195afa192cfee860698584c030f4c9db1',
                topics: ['0x000000000000000000000000a94f5374fce5edbc8e2a8697c15331677e6ebf0b']
              }],
              response: { result: '0x1' }
            }
          ]
        },
        {
          name: 'eth_newBlockFilter',
          description: 'Creates a filter for new blocks',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Create block filter',
              params: [],
              response: { result: '0x1' }
            }
          ]
        },
        {
          name: 'eth_newPendingTransactionFilter',
          description: 'Creates a filter for pending transactions',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Create pending transaction filter',
              params: [],
              response: { result: '0x1' }
            }
          ]
        },
        {
          name: 'eth_uninstallFilter',
          description: 'Uninstalls a filter',
          implemented: true,
          params: [
            { name: 'filterId', type: 'quantity', description: 'Filter ID', example: '0xb' }
          ],
          examples: [
            {
              name: 'Uninstall filter',
              params: ['0xb'],
              response: { result: true }
            }
          ]
        },
        {
          name: 'eth_getFilterChanges',
          description: 'Polling method for a filter',
          implemented: false,
          params: [
            { name: 'filterId', type: 'quantity', description: 'Filter ID', example: '0x16' }
          ],
          examples: [
            {
              name: 'Get filter changes',
              params: ['0x16'],
              response: {
                error: {
                  code: -32000,
                  message: 'Filter not found'
                }
              }
            }
          ]
        },
        {
          name: 'eth_getFilterLogs',
          description: 'Returns all logs matching filter',
          implemented: false,
          params: [
            { name: 'filterId', type: 'quantity', description: 'Filter ID', example: '0x16' }
          ],
          examples: [
            {
              name: 'Get filter logs',
              params: ['0x16'],
              response: {
                error: {
                  code: -32000,
                  message: 'Filter not found'
                }
              }
            }
          ]
        },
        {
          name: 'eth_maxPriorityFeePerGas',
          description: 'Returns the current max priority fee per gas',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get max priority fee',
              params: [],
              response: { result: '0x3b9aca00' }
            }
          ]
        },
        {
          name: 'eth_feeHistory',
          description: 'Returns fee history',
          implemented: false,
          params: [
            { name: 'blockCount', type: 'quantity', description: 'Number of blocks', example: '0x5' },
            { name: 'newestBlock', type: 'string', description: 'Newest block', example: 'latest' },
            { name: 'rewardPercentiles', type: 'array', description: 'Percentiles', example: [20, 30] }
          ],
          examples: [
            {
              name: 'Get fee history',
              params: ['0x5', 'latest', [20, 30]],
              response: {
                error: {
                  code: -32601,
                  message: 'Method not found'
                }
              }
            }
          ]
        },
        {
          name: 'eth_getProof',
          description: 'Returns the merkle proof for a given account',
          implemented: true,
          issue: 'Requires block height > 2',
          params: [
            { name: 'address', type: 'address', description: 'Account address', example: '0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842' },
            { name: 'storageKeys', type: 'array', description: 'Storage keys', example: ['0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421'] },
            { name: 'block', type: 'string', description: 'Block number or tag', example: 'latest' }
          ],
          examples: [
            {
              name: 'Get account proof',
              params: [
                '0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842',
                ['0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421'],
                'latest'
              ],
              response: {
                result: {
                  address: '0x7F0d15C7FAae65896648C8273B6d7E43f58Fa842',
                  accountProof: [],
                  balance: '0x0',
                  codeHash: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
                  nonce: '0x0',
                  storageHash: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
                  storageProof: []
                }
              }
            }
          ]
        },
        {
          name: 'eth_getUncleCountByBlockHash',
          description: 'Get uncle count by block hash',
          implemented: true,
          params: [
            { name: 'blockHash', type: 'hash', description: 'Block hash', example: '0x1b9911f57c13e5160d567ea6cf5b545413f96b95e43ec6e02787043351fb2cc4' }
          ],
          examples: [
            {
              name: 'Get uncle count',
              params: ['0x1b9911f57c13e5160d567ea6cf5b545413f96b95e43ec6e02787043351fb2cc4'],
              response: {
                result: '0x0'
              }
            }
          ]
        },
        {
          name: 'eth_getUncleCountByBlockNumber',
          description: 'Get uncle count by block number',
          implemented: true,
          params: [
            { name: 'blockNumber', type: 'string', description: 'Block number or tag', example: 'latest' }
          ],
          examples: [
            {
              name: 'Get uncle count',
              params: ['latest'],
              response: {
                result: '0x0'
              }
            }
          ]
        }
      ]
    },
    personal: {
      name: 'Personal',
      icon: SmartContractIcon,
      methods: [
        {
          name: 'personal_importRawKey',
          description: 'Import unencrypted private key into key store',
          implemented: true,
          private: true,
          params: [
            { name: 'privkey', type: 'string', description: 'Hex encoded private key', example: 'c5bd76cd0cd948de17a31261567d219576e992d9066fe1a6bca97496dec634e2c8e06f8949773b300b9f73fabbbc7710d5d6691e96bcf3c9145e15daf6fe07b9' },
            { name: 'password', type: 'string', description: 'Password for encryption', example: 'the key is this' }
          ],
          examples: [
            {
              name: 'Import key',
              params: ['c5bd76cd0cd948de17a31261567d219576e992d9066fe1a6bca97496dec634e2c8e06f8949773b300b9f73fabbbc7710d5d6691e96bcf3c9145e15daf6fe07b9', 'the key is this'],
              response: {
                result: '0x3b7252d007059ffc82d16d022da3cbf9992d2f70'
              }
            }
          ]
        },
        {
          name: 'personal_listAccounts',
          description: 'List addresses for accounts managed by node',
          implemented: true,
          private: true,
          params: [],
          examples: [
            {
              name: 'List accounts',
              params: [],
              response: {
                result: ['0x3b7252d007059ffc82d16d022da3cbf9992d2f70', '0xddd64b4712f7c8f1ace3c145c950339eddaf221d', '0x0f54f47bf9b8e317b214ccd6a7c3e38b893cd7f0']
              }
            }
          ]
        },
        {
          name: 'personal_lockAccount',
          description: 'Remove private key from memory',
          implemented: true,
          private: true,
          params: [
            { name: 'address', type: 'address', description: 'Account to lock', example: '0x0f54f47bf9b8e317b214ccd6a7c3e38b893cd7f0' }
          ],
          examples: [
            {
              name: 'Lock account',
              params: ['0x0f54f47bf9b8e317b214ccd6a7c3e38b893cd7f0'],
              response: {
                result: true
              }
            }
          ]
        },
        {
          name: 'personal_newAccount',
          description: 'Generate new private key and store in key store',
          implemented: true,
          private: true,
          params: [
            { name: 'passphrase', type: 'string', description: 'Passphrase for encryption', example: 'This is the passphrase' }
          ],
          examples: [
            {
              name: 'Create account',
              params: ['This is the passphrase'],
              response: {
                result: '0xf0e4086ad1c6aab5d42161d5baaae2f9ad0571c0'
              }
            }
          ]
        },
        {
          name: 'personal_unlockAccount',
          description: 'Decrypt account key in memory',
          implemented: true,
          private: true,
          params: [
            { name: 'address', type: 'address', description: 'Account address', example: '0x0f54f47bf9b8e317b214ccd6a7c3e38b893cd7f0' },
            { name: 'passphrase', type: 'string', description: 'Account passphrase', example: 'secret passphrase' },
            { name: 'duration', type: 'number', description: 'Unlock duration in seconds', example: 30 }
          ],
          examples: [
            {
              name: 'Unlock for 30 seconds',
              params: ['0x0f54f47bf9b8e317b214ccd6a7c3e38b893cd7f0', 'secret passphrase', 30],
              response: {
                result: true
              }
            }
          ]
        },
        {
          name: 'personal_sendTransaction',
          description: 'Validate passphrase and submit transaction',
          implemented: true,
          private: true,
          params: [
            {
              name: 'transaction',
              type: 'object',
              description: 'Transaction object',
              fields: [
                { name: 'from', type: 'address', description: 'Sender address' },
                { name: 'to', type: 'address', description: 'Recipient address' },
                { name: 'value', type: 'quantity', description: 'Value to send' }
              ]
            },
            { name: 'passphrase', type: 'string', description: 'Account passphrase', example: 'passphrase' }
          ],
          examples: [
            {
              name: 'Send transaction',
              params: [
                {
                  from: '0x3b7252d007059ffc82d16d022da3cbf9992d2f70',
                  to: '0xddd64b4712f7c8f1ace3c145c950339eddaf221d',
                  value: '0x16345785d8a0000'
                },
                'passphrase'
              ],
              response: {
                result: '0xd2a31ec1b89615c8d1f4d08fe4e4182efa4a9c0d5758ace6676f485ea60e154c'
              }
            }
          ]
        },
        {
          name: 'personal_sign',
          description: 'Sign message with account',
          implemented: true,
          private: true,
          params: [
            { name: 'message', type: 'bytes', description: 'Message to sign', example: '0xdeadbeef' },
            { name: 'account', type: 'address', description: 'Account address', example: '0x3b7252d007059ffc82d16d022da3cbf9992d2f70' },
            { name: 'password', type: 'string', description: 'Account password', example: 'password' }
          ],
          examples: [
            {
              name: 'Sign message',
              params: ['0xdeadbeef', '0x3b7252d007059ffc82d16d022da3cbf9992d2f70', 'password'],
              response: {
                result: '0xf9ff74c86aefeb5f6019d77280bbb44fb695b4d45cfe97e6eed7acd62905f4a85034d5c68ed25a2e7a8eeb9baf1b8401e4f865d92ec48c1763bf649e354d900b1c'
              }
            }
          ]
        },
        {
          name: 'personal_ecRecover',
          description: 'Recover address from signature',
          implemented: true,
          private: true,
          params: [
            { name: 'message', type: 'bytes', description: 'Original message', example: '0xdeadbeef' },
            { name: 'signature', type: 'string', description: 'Signature from personal_sign', example: '0xf9ff74c86aefeb5f6019d77280bbb44fb695b4d45cfe97e6eed7acd62905f4a85034d5c68ed25a2e7a8eeb9baf1b8401e4f865d92ec48c1763bf649e354d900b1c' }
          ],
          examples: [
            {
              name: 'Recover address',
              params: ['0xdeadbeef', '0xf9ff74c86aefeb5f6019d77280bbb44fb695b4d45cfe97e6eed7acd62905f4a85034d5c68ed25a2e7a8eeb9baf1b8401e4f865d92ec48c1763bf649e354d900b1c'],
              response: {
                result: '0x3b7252d007059ffc82d16d022da3cbf9992d2f70'
              }
            }
          ]
        },
        {
          name: 'personal_initializeWallet',
          description: 'Initialize new wallet at URL',
          implemented: false,
          private: true,
          params: [
            { name: 'url', type: 'string', description: 'Wallet URL', example: 'keystore://path/to/wallet' }
          ],
          examples: [
            {
              name: 'Initialize wallet',
              params: ['keystore://path/to/wallet'],
              response: {
                result: '0xNewPrivateKey'
              }
            }
          ]
        },
        {
          name: 'personal_unpair',
          description: 'Delete wallet pairing',
          implemented: false,
          private: true,
          params: [
            { name: 'url', type: 'string', description: 'Wallet URL', example: 'keystore://path/to/wallet' },
            { name: 'pin', type: 'string', description: 'Pairing password', example: '1234' }
          ],
          examples: [
            {
              name: 'Unpair wallet',
              params: ['keystore://path/to/wallet', '1234'],
              response: {
                result: true
              }
            }
          ]
        },
        {
          name: 'personal_listWallets',
          description: 'List wallets managed by node',
          implemented: true,
          private: true,
          params: [],
          examples: [
            {
              name: 'List wallets',
              params: [],
              response: {
                result: null
              }
            }
          ]
        }
      ]
    },
    debug: {
      name: 'Debug',
      icon: SmartContractIcon,
      methods: [
        {
          name: 'debug_traceTransaction',
          description: 'Trace transaction execution',
          implemented: true,
          private: true,
          issue: 'Height issues in current implementation',
          params: [
            { name: 'txHash', type: 'hash', description: 'Transaction hash', example: '0x4ed38df88f88...' },
            {
              name: 'config',
              type: 'object',
              description: 'Trace config (optional)',
              fields: [
                { name: 'tracer', type: 'string', description: 'Tracer type (callTracer, prestateTracer)' },
                { name: 'timeout', type: 'string', description: 'Execution timeout' }
              ]
            }
          ],
          examples: [
            {
              name: 'Basic trace',
              params: ['0x4ed38df88f88...', {}],
              response: {
                result: {
                  gas: 21000,
                  failed: false,
                  returnValue: '0x',
                  structLogs: []
                }
              }
            },
            {
              name: 'Call tracer',
              params: ['0x4ed38df88f88...', { tracer: 'callTracer' }],
              response: {
                result: {
                  type: 'CALL',
                  from: '0x...',
                  to: '0x...',
                  value: '0x0',
                  gas: '0x5208',
                  gasUsed: '0x5208',
                  input: '0x',
                  output: '0x'
                }
              }
            }
          ]
        },
        {
          name: 'debug_traceBlockByNumber',
          description: 'Replay block by number',
          implemented: true,
          private: true,
          params: [
            { name: 'blockNumber', type: 'string', description: 'Block number', example: '0xe' },
            { name: 'config', type: 'object', description: 'Trace config (optional)' }
          ],
          examples: [
            {
              name: 'Trace block',
              params: ['0xe', {}],
              response: {
                result: [{
                  result: {
                    failed: false,
                    gas: 21000,
                    returnValue: '0x',
                    structLogs: []
                  }
                }]
              }
            }
          ]
        },
        {
          name: 'debug_traceBlockByHash',
          description: 'Replay block by hash',
          implemented: true,
          private: true,
          params: [
            { name: 'blockHash', type: 'hash', description: 'Block hash', example: '0x1b9911f57c13e5160d567ea6cf5b545413f96b95e43ec6e02787043351fb2cc4' },
            { name: 'config', type: 'object', description: 'Trace config (optional)' }
          ],
          examples: [
            {
              name: 'Trace block',
              params: ['0x1b9911f57c13e5160d567ea6cf5b545413f96b95e43ec6e02787043351fb2cc4', {}],
              response: {
                result: [{
                  result: {
                    failed: false,
                    gas: 21000,
                    returnValue: '0x',
                    structLogs: []
                  }
                }]
              }
            }
          ]
        },
        {
          name: 'debug_freeOSMemory',
          description: 'Force garbage collection',
          implemented: true,
          private: true,
          params: [],
          examples: [
            {
              name: 'Free memory',
              params: [],
              response: {
                result: null
              }
            }
          ]
        },
        {
          name: 'debug_setGCPercent',
          description: 'Set garbage collection target percentage',
          implemented: true,
          private: true,
          params: [
            { name: 'percent', type: 'number', description: 'GC percentage', example: 100 }
          ],
          examples: [
            {
              name: 'Set GC to 100%',
              params: [100],
              response: {
                result: 100
              }
            }
          ]
        },
        {
          name: 'debug_memStats',
          description: 'Get runtime memory statistics',
          implemented: true,
          private: true,
          params: [],
          examples: [
            {
              name: 'Get memory stats',
              params: [],
              response: {
                result: {
                  Alloc: 83328680,
                  TotalAlloc: 451796592,
                  Sys: 166452520,
                  HeapAlloc: 83328680,
                  HeapSys: 153452544,
                  HeapInuse: 101883904,
                  HeapObjects: 299114,
                  NumGC: 18
                }
              }
            }
          ]
        },
        {
          name: 'debug_setBlockProfileRate',
          description: 'Set goroutine block profile rate',
          implemented: true,
          private: true,
          params: [
            { name: 'rate', type: 'number', description: 'Profile rate', example: 1 }
          ],
          examples: [
            {
              name: 'Enable profiling',
              params: [1],
              response: {
                result: null
              }
            }
          ]
        },
        {
          name: 'debug_writeBlockProfile',
          description: 'Write goroutine blocking profile',
          implemented: true,
          private: true,
          params: [
            { name: 'file', type: 'string', description: 'Output file path', example: 'block.prof' }
          ],
          examples: [
            {
              name: 'Write profile',
              params: ['block.prof'],
              response: {
                result: null
              }
            }
          ]
        },
        {
          name: 'debug_writeMemProfile',
          description: 'Write allocation profile',
          implemented: true,
          private: true,
          params: [
            { name: 'file', type: 'string', description: 'Output file path', example: 'mem.prof' }
          ],
          examples: [
            {
              name: 'Write profile',
              params: ['mem.prof'],
              response: {
                result: null
              }
            }
          ]
        },
        {
          name: 'debug_writeMutexProfile',
          description: 'Write mutex contention profile',
          implemented: true,
          private: true,
          params: [
            { name: 'file', type: 'string', description: 'Output file path', example: 'mutex.prof' }
          ],
          examples: [
            {
              name: 'Write profile',
              params: ['mutex.prof'],
              response: {
                result: null
              }
            }
          ]
        }
      ]
    },
    txpool: {
      name: 'TxPool',
      icon: NetworkIcon,
      methods: [
        {
          name: 'txpool_content',
          description: 'Get exact details of all pending and queued transactions',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get pool content',
              params: [],
              response: {
                result: {
                  pending: {},
                  queued: {}
                }
              }
            }
          ]
        },
        {
          name: 'txpool_inspect',
          description: 'Get summary of pending and queued transactions',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Inspect pool',
              params: [],
              response: {
                result: {
                  pending: {},
                  queued: {}
                }
              }
            }
          ]
        },
        {
          name: 'txpool_status',
          description: 'Get number of pending and queued transactions',
          implemented: true,
          params: [],
          examples: [
            {
              name: 'Get pool status',
              params: [],
              response: {
                result: {
                  pending: '0x0',
                  queued: '0x0'
                }
              }
            }
          ]
        }
      ]
    }
  };

  const toggleMethod = (method) => {
    setExpandedMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
  };

  const executeRpcRequest = async (methodName, params = []) => {
    if (!rpcEndpoint) {
      alert('Please enter an RPC endpoint URL');
      return;
    }

    const requestId = `${methodName}-${Date.now()}`;
    setIsLoading(prev => ({ ...prev, [methodName]: true }));

    try {
      const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: methodName,
          params: params
        })
      });

      const data = await response.json();
      setRequestResults(prev => ({
        ...prev,
        [methodName]: data
      }));
    } catch (error) {
      setRequestResults(prev => ({
        ...prev,
        [methodName]: {
          error: {
            message: error.message,
            code: -1
          }
        }
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, [methodName]: false }));
    }
  };

  const getSelectedLanguage = (methodName) => {
    return selectedLanguage[methodName] || 'curl';
  };

  const setMethodLanguage = (methodName, language) => {
    setSelectedLanguage(prev => ({
      ...prev,
      [methodName]: language
    }));
  };

  // Get all methods from all namespaces for global search
  const allMethods = useMemo(() => {
    const methods = [];
    Object.entries(namespaces).forEach(([key, namespace]) => {
      namespace.methods.forEach(method => {
        methods.push({ ...method, namespace: key, namespaceName: namespace.name });
      });
    });
    return methods;
  }, []);

  const filteredMethods = useMemo(() => {
    // If there's a search term, search all methods
    if (searchTerm) {
      return allMethods.filter(method => {
        const matchesSearch = method.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            method.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });
    }

    // Show all methods if 'all' is selected
    if (selectedNamespace === 'all') {
      return allMethods;
    }

    // Otherwise, show methods from selected namespace
    const namespace = namespaces[selectedNamespace];
    if (!namespace) return [];

    return namespace.methods.map(method => ({
      ...method,
      namespace: selectedNamespace,
      namespaceName: namespace.name
    }));
  }, [selectedNamespace, searchTerm, allMethods]);

  function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <button
        onClick={handleCopy}
        className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors font-mono"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-4xl font-bold text-black dark:text-white">
              Ethereum JSON-RPC Methods
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Complete reference for Cosmos EVM implementation
            </p>
            {isValidEndpoint && (
              <p className="mt-2 text-sm text-[#05fcf8]">
                ✓ Interactive mode active - Click "Execute" on any method example to test against {rpcEndpoint}
              </p>
            )}
          </div>

          {/* Search and Filters */}
          <div className="pb-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search methods..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white bg-white dark:bg-gray-900 text-black dark:text-white placeholder-gray-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Interactive RPC Section - Right-aligned, compact */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Enter an RPC endpoint to enable interactive testing
                </span>
                <div className={`px-3 py-2 rounded-lg transition-all duration-200 border-2 ${
                  isValidEndpoint
                    ? 'border-[#05fcf8]'
                    : isInvalidEndpoint
                    ? 'border-amber-500'
                    : 'border-gray-300 dark:border-gray-700'
                } bg-white dark:bg-gray-900`}>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">RPC Endpoint:</label>
                    <input
                      type="text"
                      placeholder="http://localhost:8545"
                      className="w-64 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:border-gray-400 bg-white dark:bg-black text-black dark:text-white placeholder-gray-500"
                      value={rpcEndpoint}
                      onChange={(e) => {
                        setRpcEndpoint(e.target.value);
                        setIsValidEndpoint(false);
                        setIsInvalidEndpoint(false);
                      }}
                      onBlur={async () => {
                        if (rpcEndpoint && rpcEndpoint.match(/^https?:\/\//)) {
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
                            if (response.ok) {
                              setIsValidEndpoint(true);
                              setIsInvalidEndpoint(false);
                            } else {
                              setIsValidEndpoint(false);
                              setIsInvalidEndpoint(true);
                            }
                          } catch (error) {
                            setIsValidEndpoint(false);
                            setIsInvalidEndpoint(true);
                          }
                        }
                      }}
                    />
                    {isValidEndpoint && (
                      <span className="text-[#05fcf8] text-lg">✓</span>
                    )}
                    {isInvalidEndpoint && (
                      <span className="text-red-500 text-lg">✗</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-500 text-right max-w-md">
                Note: Some endpoints may require CORS configuration or have other restrictions that prevent browser-based requests
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Namespace Tabs */}
      <div className="sticky top-[165px] z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 overflow-x-auto py-3">
            <button
              onClick={() => setSelectedNamespace('all')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap text-sm ${
                selectedNamespace === 'all'
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-[0_0_0_1px_rgba(0,0,0,0.3)]'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-[0_0_0_1px_rgba(156,163,175,0.3)] dark:shadow-[0_0_0_1px_rgba(75,85,99,0.5)]'
              }`}
            >
              <span className="font-medium">All</span>
            </button>
            {Object.entries(namespaces).map(([key, namespace]) => (
              <button
                key={key}
                onClick={() => setSelectedNamespace(key)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap text-sm ${
                  selectedNamespace === key
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="text-base">{namespace.icon}</span>
                <span className="font-medium">{namespace.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Methods List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {filteredMethods.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No methods found matching your criteria
              </p>
            </div>
          ) : (
            filteredMethods.map((method) => (
              <div
                key={method.name}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-[0_0_0_1px_rgba(156,163,175,0.3)] dark:shadow-[0_0_0_1px_rgba(75,85,99,0.5)] overflow-hidden"
              >
                <button
                  onClick={() => toggleMethod(method.name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <code className="text-sm font-mono text-black dark:text-white">
                        {method.name}
                      </code>
                      {(searchTerm || selectedNamespace === 'all') && method.namespace && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded">
                          {namespaces[method.namespace].name}
                        </span>
                      )}
                      {method.private && (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                          Private
                        </span>
                      )}
                      {!method.implemented && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                          Not implemented in the Cosmos/EVM base module
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-left">
                      {method.description}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform flex-shrink-0 ${
                      expandedMethods[method.name] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedMethods[method.name] && (
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
                    {method.issue && (
                      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          ⚠️ {method.issue}
                        </p>
                      </div>
                    )}

                    {method.params && method.params.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Parameters
                        </h4>
                        <div className="space-y-3">
                          {method.params.map((param, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div>
                                  <code className="text-sm font-mono text-black dark:text-white">
                                    {param.name}
                                  </code>
                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                    {param.type}
                                  </span>
                                </div>
                                {param.example && (
                                  <code className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    Example: {param.example}
                                  </code>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {param.description}
                              </p>
                              {param.fields && (
                                <div className="mt-2 ml-4 space-y-1">
                                  {param.fields.map((field, j) => (
                                    <div key={j} className="text-xs">
                                      <code className="text-black dark:text-white">{field.name}</code>
                                      <span className="text-gray-500"> ({field.type})</span>
                                      <span className="text-gray-600 dark:text-gray-400"> - {field.description}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {method.examples && method.examples.length > 0 && (
                      <div className="space-y-6">
                        {method.examples.map((example, exampleIndex) => (
                          <div key={exampleIndex} className="shadow-[0_0_0_1px_rgba(156,163,175,0.3)] dark:shadow-[0_0_0_1px_rgba(75,85,99,0.5)] rounded-lg overflow-hidden">
                            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                Example: {example.name}
                              </h5>
                              {rpcEndpoint && rpcEndpoint.match(/^https?:\/\//) && (
                                <button
                                  onClick={() => executeRpcRequest(method.name, example.params)}
                                  disabled={isLoading[method.name]}
                                  className="px-3 py-0.5 text-xs bg-[#05fcf8] hover:bg-[#04e8e5] text-black font-medium rounded transition-colors disabled:opacity-50"
                                >
                                  {isLoading[method.name] ? 'Loading...' : 'Execute'}
                                </button>
                              )}
                            </div>

                            {/* Language Tabs */}
                            <div className="border-b border-gray-200 dark:border-gray-700">
                              <div className="flex overflow-x-auto">
                                {languages.map(lang => (
                                  <button
                                    key={lang.id}
                                    onClick={() => setMethodLanguage(`${method.name}-${exampleIndex}`, lang.id)}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                      getSelectedLanguage(`${method.name}-${exampleIndex}`) === lang.id
                                        ? 'border-black dark:border-white text-black dark:text-white'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                  >
                                    <span className="mr-1.5 inline-block">
                                      <lang.icon size={16} />
                                    </span>
                                    {lang.name}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Code Example */}
                            <div className="relative">
                              <div className="absolute top-2 right-2">
                                <CopyButton text={generateCodeExamples(method.name, example.params)[getSelectedLanguage(`${method.name}-${exampleIndex}`)]} />
                              </div>
                              <pre className="p-4 bg-gray-900 dark:bg-black text-gray-100 overflow-x-auto text-xs">
                                <code>
                                  {generateCodeExamples(method.name, example.params)[getSelectedLanguage(`${method.name}-${exampleIndex}`)]}
                                </code>
                              </pre>
                            </div>

                            {/* Response */}
                            {rpcEndpoint && rpcEndpoint.match(/^https?:\/\//) && requestResults[method.name] ? (
                              // Show live response when interactive mode is on and we have results
                              <div className="border-t border-gray-200 dark:border-gray-700">
                                <div className="px-4 py-2 bg-[#05fcf8]/10 dark:bg-[#05fcf8]/10">
                                  <h6 className="text-xs font-medium text-gray-900 dark:text-[#05fcf8]">
                                    Live RPC Response from {rpcEndpoint}
                                  </h6>
                                </div>
                                <pre className="p-4 bg-gray-900 dark:bg-black text-xs overflow-x-auto">
                                  <code className={requestResults[method.name].error ? 'text-red-400' : 'text-green-400'}>
{JSON.stringify(requestResults[method.name], null, 2)}
                                  </code>
                                </pre>
                              </div>
                            ) : (
                              // Show example response when not interactive or no results yet
                              <div className="border-t border-gray-200 dark:border-gray-700">
                                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800">
                                  <h6 className="text-xs font-medium text-gray-900 dark:text-white">
                                    Example Response
                                  </h6>
                                </div>
                                <pre className="p-4 bg-gray-50 dark:bg-black text-xs overflow-x-auto">
                                  <code className={example.response.error ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
{JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  ...example.response
}, null, 2)}
                                  </code>
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}