import { useState, useEffect, useRef } from 'react';

export const BlockchainDemo = () => {
  const [blocks, setBlocks] = useState([
    { height: 1, previousHash: '0000', data: 'User A sends 100 to User B', hash: '' },
    { height: 2, previousHash: '', data: 'User C sends 50 to User D', hash: '' },
    { height: 3, previousHash: '', data: 'User E sends 25 to User F', hash: '' },
  ]);

  const initialized = useRef(false);

  // SHA-256 hash function
  const calculateHash = async (height, previousHash, data) => {
    const text = `${height}${previousHash}${data}`;
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 8); // First 8 chars for display
  };

  // Initialize hashes on mount
  useEffect(() => {
    if (initialized.current) return;

    const initializeHashes = async () => {
      const updatedBlocks = [...blocks];

      // Calculate initial hashes
      for (let i = 0; i < updatedBlocks.length; i++) {
        const prevHash = i === 0 ? '0000' : updatedBlocks[i - 1].hash;
        updatedBlocks[i].previousHash = prevHash;
        updatedBlocks[i].hash = await calculateHash(
          updatedBlocks[i].height,
          prevHash,
          updatedBlocks[i].data
        );
      }

      setBlocks(updatedBlocks);
      initialized.current = true;
    };

    initializeHashes();
  }, []);

  // Recalculate hash when a block's data changes
  const handleDataChange = async (index, newData) => {
    const updatedBlocks = [...blocks];
    updatedBlocks[index].data = newData;

    // Recalculate only this block's hash
    updatedBlocks[index].hash = await calculateHash(
      updatedBlocks[index].height,
      updatedBlocks[index].previousHash,
      newData
    );

    setBlocks(updatedBlocks);
  };

  // Add a new block
  const addNewBlock = async () => {
    const lastBlock = blocks[blocks.length - 1];
    const newBlock = {
      height: lastBlock.height + 1,
      previousHash: lastBlock.hash,
      data: 'New Block',
      hash: '',
    };

    // Calculate hash for the new block
    newBlock.hash = await calculateHash(
      newBlock.height,
      newBlock.previousHash,
      newBlock.data
    );

    setBlocks([...blocks, newBlock]);
  };

  // Check if a block is valid (cascading validation)
  const isValid = (index) => {
    if (index === 0) return true; // Genesis block is always valid

    // Check if any previous block in the chain is invalid
    for (let i = 1; i <= index; i++) {
      if (blocks[i].previousHash !== blocks[i - 1].hash) {
        return false; // Chain is broken at or before this block
      }
    }

    return true;
  };

  return (
    <div className="not-prose w-full max-w-5xl mx-auto py-8">
      <div className="overflow-x-auto">
        <div className="flex gap-4 items-center justify-start min-w-max pb-4">
          {blocks.map((block, index) => (
            <div key={index} className="flex items-center gap-4 flex-shrink-0">
              {/* Block Card */}
              <div className="relative bg-white dark:bg-[#1a1a1a] border-2 border-gray-200 dark:border-gray-700 rounded-xl p-5 w-[260px] shadow-lg">
                {/* Block Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Block {block.height}
                  </h3>
                  {isValid(index) ? (
                    <span className="text-xl">✅</span>
                  ) : (
                    <span className="text-xl">❌</span>
                  )}
                </div>

                {/* Previous Hash */}
                <div className="mb-3">
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                    Previous Hash
                  </label>
                  <div className={`px-2.5 py-1.5 rounded-lg font-mono text-xs break-all ${
                    isValid(index)
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                  }`}>
                    {block.previousHash || '...'}
                  </div>
                  {!isValid(index) && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 font-medium">
                      MISMATCH
                    </p>
                  )}
                </div>

                {/* Data Field */}
                <div className="mb-3">
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                    Data
                  </label>
                  <textarea
                    value={block.data}
                    onChange={(e) => handleDataChange(index, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter block data..."
                  />
                </div>

                {/* Current Hash */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                    Hash
                  </label>
                  <div className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg font-mono text-xs break-all">
                    {block.hash || 'calculating...'}
                  </div>
                </div>
              </div>

              {/* Arrow between blocks */}
              {index < blocks.length - 1 && (
                <div className="text-3xl text-gray-400 dark:text-gray-600 flex-shrink-0">
                  →
                </div>
              )}
            </div>
          ))}

          {/* Add Block Button */}
          {blocks.length < 6 && (
            <button
              onClick={addNewBlock}
              className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors shadow-lg border-2 border-blue-600 dark:border-blue-700"
            >
              + Add Block
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Try editing the data in any block and watch how it breaks the chain!
          The hash will change, making all subsequent blocks invalid. Add new blocks to grow the chain.
        </p>
      </div>
    </div>
  );
};
