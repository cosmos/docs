import { useState, useMemo } from 'react';
import { 
  Terminal, 
  FileCode2, 
  Play, 
  Zap, 
  Code, 
  Hash, 
  Globe, 
  Network, 
  Coins, 
  FileKey, 
  Bug, 
  Database,
  Check,
  X
} from 'lucide-react';

// Language icons
const CurlIcon = () => <Terminal size={16} />;
const TypeScriptIcon = () => <FileCode2 size={16} />;
const GoIcon = () => <Play size={16} />;
const RustIcon = () => <Zap size={16} />;
const PythonIcon = () => <Code size={16} />;
const CSharpIcon = () => <Hash size={16} />;

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
      icon: Globe,
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
      icon: Network,
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
      icon: Coins,
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
        }
      ]
    },
    personal: {
      name: 'Personal',
      icon: FileKey,
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
        }
      ]
    },
    debug: {
      name: 'Debug',
      icon: Bug,
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
            }
          ]
        }
      ]
    },
    txpool: {
      name: 'TxPool',
      icon: Database,
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
        className="px-3 py-1.5 text-xs bg-white hover:bg-gray-50 text-black border border-gray-200 rounded-md transition-colors duration-200 font-mono"
        style={{ fontFamily: 'The Future Mono, monospace' }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    );
  }

  return (
    <div className="min-h-screen text-black" style={{ 
      backgroundColor: '#F1F1F1',
      fontFamily: 'The Future, sans-serif'
    }}>
      <style>
        {`
          @font-face {
            font-family: 'The Future Mono';
            src: url('https://fonts.cosmoslabs.io/fonts/the-future-mono-regular.woff2') format('woff2');
            font-weight: 400;
          }
          @font-face {
            font-family: 'The Future';
            src: url('https://fonts.cosmoslabs.io/fonts/the-future-regular.woff2') format('woff2');
            font-weight: 400;
          }
        `}
      </style>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="py-8">
            <h1 className="text-5xl font-bold text-black mb-4" style={{ fontFamily: 'The Future Mono, monospace' }}>
              Ethereum JSON-RPC Methods
            </h1>
            <p className="text-lg" style={{ color: '#cccccc' }}>
              Complete reference for Cosmos EVM implementation
            </p>
            {isValidEndpoint && (
              <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#0E0E0E', color: '#cccccc' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Interactive mode active - Click "Execute" on any method example to test against {rpcEndpoint}</span>
                </div>
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <div className="pb-6 space-y-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search methods..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white text-black placeholder-gray-500 transition-all duration-200"
                  style={{ fontFamily: 'The Future, sans-serif' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Interactive RPC Section */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-4">
                <span className="text-sm" style={{ color: '#cccccc' }}>
                  Enter an RPC endpoint to enable interactive testing
                </span>
                <div className={`p-4 rounded-lg transition-all duration-300 border-2 ${
                  isValidEndpoint
                    ? 'border-green-500 bg-green-50'
                    : isInvalidEndpoint
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 bg-white'
                }`}>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-black whitespace-nowrap" style={{ fontFamily: 'The Future Mono, monospace' }}>
                      RPC Endpoint:
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:8545"
                      className="w-80 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white text-black placeholder-gray-500 transition-all duration-200"
                      style={{ fontFamily: 'The Future Mono, monospace' }}
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
                      <span className="text-green-500 text-lg font-bold">✓</span>
                    )}
                    {isInvalidEndpoint && (
                      <span className="text-red-500 text-lg font-bold">✗</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs max-w-md text-right" style={{ color: '#cccccc' }}>
                Note: Some endpoints may require CORS configuration or have other restrictions that prevent browser-based requests
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Namespace Tabs */}
      <div className="sticky top-[200px] z-10 border-b border-gray-200" style={{ backgroundColor: '#0E0E0E' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex space-x-2 overflow-x-auto py-4">
            <button
              onClick={() => setSelectedNamespace('all')}
              className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm font-medium ${
                selectedNamespace === 'all'
                  ? 'bg-white text-black'
                  : 'text-white hover:bg-gray-800'
              }`}
              style={{ fontFamily: 'The Future Mono, monospace' }}
            >
              <span>All</span>
            </button>
            {Object.entries(namespaces).map(([key, namespace]) => (
              <button
                key={key}
                onClick={() => setSelectedNamespace(key)}
                className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm font-medium ${
                  selectedNamespace === key
                    ? 'bg-white text-black'
                    : 'text-white hover:bg-gray-800'
                }`}
                style={{ fontFamily: 'The Future Mono, monospace' }}
              >
                <namespace.icon size={18} />
                <span>{namespace.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Methods List */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {filteredMethods.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg" style={{ color: '#cccccc' }}>
                No methods found matching your criteria
              </p>
            </div>
          ) : (
            filteredMethods.map((method) => (
              <div
                key={method.name}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <button
                  onClick={() => toggleMethod(method.name)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 text-left"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex items-center space-x-3">
                      <code className="text-base font-medium text-black px-3 py-1 rounded-md" style={{ 
                        fontFamily: 'The Future Mono, monospace',
                        backgroundColor: '#F1F1F1'
                      }}>
                        {method.name}
                      </code>
                      {(searchTerm || selectedNamespace === 'all') && method.namespace && (
                        <span className="px-2 py-1 text-xs font-medium rounded-md" style={{ 
                          backgroundColor: '#cccccc',
                          color: '#000000'
                        }}>
                          {namespaces[method.namespace].name}
                        </span>
                      )}
                      {method.private && (
                        <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-md">
                          Private
                        </span>
                      )}
                      {!method.implemented && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-md">
                          Not implemented
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-left flex-1" style={{ fontFamily: 'The Future, sans-serif' }}>
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
                  <div className="px-6 py-5 border-t border-gray-200" style={{ backgroundColor: '#F1F1F1' }}>
                    {method.issue && (
                      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800" style={{ fontFamily: 'The Future, sans-serif' }}>
                          Warning: {method.issue}
                        </p>
                      </div>
                    )}

                    {method.params && method.params.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-sm font-semibold text-black mb-4" style={{ fontFamily: 'The Future Mono, monospace' }}>
                          Parameters
                        </h4>
                        <div className="space-y-4">
                          {method.params.map((param, i) => (
                            <div key={i} className="bg-white p-4 rounded-lg border border-gray-200">
                              <div className="flex items-start justify-between">
                                <div>
                                  <code className="text-sm font-medium text-black" style={{ fontFamily: 'The Future Mono, monospace' }}>
                                    {param.name}
                                  </code>
                                  <span className="ml-2 text-xs px-2 py-1 rounded-md" style={{ 
                                    backgroundColor: '#cccccc',
                                    color: '#000000'
                                  }}>
                                    {param.type}
                                  </span>
                                </div>
                                {param.example && (
                                  <code className="text-xs text-gray-600" style={{ fontFamily: 'The Future Mono, monospace' }}>
                                    Example: {param.example}
                                  </code>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-gray-600" style={{ fontFamily: 'The Future, sans-serif' }}>
                                {param.description}
                              </p>
                              {param.fields && (
                                <div className="mt-3 ml-4 space-y-2">
                                  {param.fields.map((field, j) => (
                                    <div key={j} className="text-xs">
                                      <code className="text-black" style={{ fontFamily: 'The Future Mono, monospace' }}>{field.name}</code>
                                      <span className="text-gray-500"> ({field.type})</span>
                                      <span className="text-gray-600"> - {field.description}</span>
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
                      <div className="space-y-8">
                        {method.examples.map((example, exampleIndex) => (
                          <div key={exampleIndex} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200" style={{ backgroundColor: '#0E0E0E' }}>
                              <h5 className="text-sm font-medium text-white" style={{ fontFamily: 'The Future Mono, monospace' }}>
                                Example: {example.name}
                              </h5>
                              {rpcEndpoint && rpcEndpoint.match(/^https?:\/\//) && (
                                <button
                                  onClick={() => executeRpcRequest(method.name, example.params)}
                                  disabled={isLoading[method.name]}
                                  className="px-4 py-2 text-sm bg-white hover:bg-gray-100 text-black font-medium rounded-md transition-colors duration-200 disabled:opacity-50"
                                  style={{ fontFamily: 'The Future Mono, monospace' }}
                                >
                                  {isLoading[method.name] ? 'Loading...' : 'Execute'}
                                </button>
                              )}
                            </div>

                            {/* Language Tabs */}
                            <div className="border-b border-gray-200">
                              <div className="flex overflow-x-auto">
                                {languages.map(lang => (
                                  <button
                                    key={lang.id}
                                    onClick={() => setMethodLanguage(`${method.name}-${exampleIndex}`, lang.id)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                      getSelectedLanguage(`${method.name}-${exampleIndex}`) === lang.id
                                        ? 'border-black text-black bg-gray-50'
                                        : 'border-transparent text-gray-600 hover:text-black hover:bg-gray-50'
                                    }`}
                                    style={{ fontFamily: 'The Future Mono, monospace' }}
                                  >
                                    <span className="mr-2 inline-block">
                                      <lang.icon />
                                    </span>
                                    {lang.name}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Code Example */}
                            <div className="relative">
                              <div className="absolute top-4 right-4 z-10">
                                <CopyButton text={generateCodeExamples(method.name, example.params)[getSelectedLanguage(`${method.name}-${exampleIndex}`)]} />
                              </div>
                              <pre className="p-6 text-sm overflow-x-auto" style={{ 
                                backgroundColor: '#0E0E0E',
                                color: '#cccccc',
                                fontFamily: 'The Future Mono, monospace'
                              }}>
                                <code>
                                  {generateCodeExamples(method.name, example.params)[getSelectedLanguage(`${method.name}-${exampleIndex}`)]}
                                </code>
                              </pre>
                            </div>

                            {/* Response */}
                            {rpcEndpoint && rpcEndpoint.match(/^https?:\/\//) && requestResults[method.name] ? (
                              <div className="border-t border-gray-200">
                                <div className="px-6 py-3 bg-green-50 border-b border-green-200">
                                  <h6 className="text-xs font-medium text-green-800" style={{ fontFamily: 'The Future Mono, monospace' }}>
                                    Live RPC Response from {rpcEndpoint}
                                  </h6>
                                </div>
                                <pre className="p-6 text-sm overflow-x-auto" style={{ 
                                  backgroundColor: '#0E0E0E',
                                  fontFamily: 'The Future Mono, monospace'
                                }}>
                                  <code className={requestResults[method.name].error ? 'text-red-400' : 'text-green-400'}>
{JSON.stringify(requestResults[method.name], null, 2)}
                                  </code>
                                </pre>
                              </div>
                            ) : (
                              <div className="border-t border-gray-200">
                                <div className="px-6 py-3" style={{ backgroundColor: '#cccccc' }}>
                                  <h6 className="text-xs font-medium text-black" style={{ fontFamily: 'The Future Mono, monospace' }}>
                                    Example Response
                                  </h6>
                                </div>
                                <pre className="p-6 text-sm overflow-x-auto" style={{ 
                                  backgroundColor: '#F1F1F1',
                                  fontFamily: 'The Future Mono, monospace'
                                }}>
                                  <code className={example.response.error ? 'text-red-600' : 'text-green-600'}>
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