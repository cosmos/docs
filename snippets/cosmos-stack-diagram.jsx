export const CosmosStackDiagram = () => {
  return (
    <div className="relative w-full rounded-[24px] md:rounded-[32px] overflow-hidden">
      {/* Background Image */}
      <img
        src="/assets/public/banner.png"
        alt="Cosmos Banner"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Diagram Content */}
      <div className="relative flex flex-col items-center justify-center w-full px-4 py-32 md:py-28">
      {/* Top Card - Connectivity */}
      <div className="bg-black border border-solid border-white/5 flex flex-col gap-5 items-center justify-center p-4 md:p-7 rounded-[24px] w-full max-w-[721px]">
        <div className="flex flex-col-reverse md:flex-row gap-5 items-center px-0 md:px-4 w-full">
          <div className="flex-1 flex flex-col items-center md:items-start justify-center text-center md:text-left">
            <p className="text-lg md:text-2xl text-white leading-tight">
              Interoperate with any chain
            </p>
          </div>
          <div className="bg-[#323536] flex flex-col items-center justify-center px-3 py-1 md:px-5 md:py-2 rounded-full">
            <p className="text-[11px] md:text-[13px] text-white/60 tracking-[1.5px] uppercase font-medium leading-tight font-mono">
              INTEROPERABILITY
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-start justify-center w-full">
          <div className="bg-black border border-solid border-[#cfdadc]/30 flex-1 rounded-[20px] w-full">
            <div className="flex flex-col items-center justify-center px-5 py-4">
              <p className="text-base md:text-xl text-white text-center tracking-wide">
                IBC
              </p>
            </div>
          </div>
          <div className="bg-black border border-solid border-[#cfdadc]/30 flex-1 rounded-[20px] w-full">
            <div className="flex flex-col items-center justify-center px-5 py-4">
              <p className="text-base md:text-xl text-white text-center tracking-wide">
                Relayer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Connector Line 1 */}
      <div className="bg-[#F1F1F1] dark:bg-[#F1F1F1] h-[29px] w-[5px]" />

      {/* Middle Card - Business Logic */}
      <div className="bg-black border border-solid border-white/5 flex flex-col gap-7 items-center md:items-start p-4 md:p-6 rounded-[24px] w-full max-w-[721px]">
        <div className="flex flex-col-reverse md:flex-row gap-5 md:gap-7 items-center md:items-start px-0 md:px-4 w-full">
          <div className="flex-1 flex flex-col gap-1 items-center md:items-start justify-center text-center md:text-left">
            <p className="text-lg md:text-2xl text-white leading-tight">
              Cosmos SDK
            </p>
            <p className="text-sm md:text-base text-[#cfdadc] opacity-60 tracking-wide">
              Create purpose-built blockchains
            </p>
          </div>
          <div className="bg-[#323536] flex flex-col items-center justify-center px-3 py-1 md:px-5 md:py-2 rounded-full md:h-[40px]">
            <p className="text-[11px] md:text-[13px] text-white/60 tracking-[1.5px] uppercase font-medium leading-tight font-mono">
              Business Logic
            </p>
          </div>
        </div>
        <div className="bg-black border border-solid border-[#cfdadc]/30 flex flex-col gap-1 items-center justify-center px-5 py-4 rounded-[20px] w-full text-center">
          <p className="text-base md:text-xl text-white tracking-wide">
            Cosmos EVM
          </p>
          <p className="text-sm md:text-base text-[#cfdadc] opacity-60 tracking-wide">
            Run Ethereum-compatible smart contracts
          </p>
        </div>
      </div>

      {/* Connector Line 2 */}
      <div className="bg-[#F1F1F1] dark:bg-[#F1F1F1] h-[29px] w-[5px]" />

      {/* Bottom Card - Consensus */}
      <div className="bg-black border border-solid border-white/5 flex flex-col items-center md:items-end p-4 md:p-6 rounded-[24px] w-full max-w-[721px]">
        <div className="flex flex-col-reverse md:flex-row gap-5 md:gap-7 items-center md:items-start md:justify-end px-0 md:px-4 w-full">
          <div className="flex-1 flex flex-col gap-1 items-center md:items-start justify-center text-center md:text-left">
            <p className="text-lg md:text-2xl text-white leading-tight">
              Comet BFT
            </p>
            <p className="text-sm md:text-base text-[#cfdadc] opacity-60 tracking-wide">
              Secure consensus, fast finality
            </p>
          </div>
          <div className="bg-[#323536] flex flex-col items-center justify-center px-3 py-1 md:px-5 md:py-2 rounded-full md:h-[40px]">
            <p className="text-[11px] md:text-[13px] text-white/60 tracking-[1.5px] uppercase font-medium leading-tight font-mono">
              CONSENSUS
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
