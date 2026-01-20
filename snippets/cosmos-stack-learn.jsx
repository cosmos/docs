'use client'

import React, { useState } from 'react'

export const CosmosStackLearn = () => {
  const [selectedTech, setSelectedTech] = useState('Cosmos SDK')

  const TechPill = ({ name, icon, isHighlighted = false, onClick }) => {
    return (
      <button
        onClick={onClick}
        className={`flex gap-1 md:gap-2 h-8 md:h-14 items-center justify-center px-3 pr-4 md:pr-5 rounded-full transition-all duration-300 cursor-pointer ${
          isHighlighted
            ? 'bg-black hover:bg-black/90 dark:bg-[#F1F1F1] dark:hover:bg-white border border-transparent'
            : 'bg-[#323536]/20 hover:bg-[#323536]/30 dark:bg-[#323536] dark:opacity-70 dark:hover:opacity-100 dark:hover:bg-[#404243] border border-transparent'
        }`}
      >
        <div className={`size-7 md:size-8 flex items-center justify-center shrink-0 ${
          isHighlighted ? 'text-white dark:text-black' : 'text-white'
        }`}>
          {icon()}
        </div>
        <p
          className={`text-sm md:text-lg lg:text-xl leading-none tracking-normal ${
            isHighlighted ? 'text-white dark:text-black' : 'text-white dark:text-[#F1F1F1]'
          }`}
          style={{ fontFeatureSettings: "'ss09' 1" }}
        >
          {name}
        </p>
      </button>
    )
  }

  const technologies = [
    {
      name: "Cosmos SDK",
      description: "The Cosmos SDK is a modular, open-source framework for building secure, high-performance distributed ledgers and blockchains. Easily spin up secure blockchains with custom business logic that can natively interoperate with any blockchain via a native integration with the Inter-Blockchain Communication Protocol. Use predefined modules for standard functionality or create custom modules for your use case and compliance requirements, covering permissioning, tokenization, compliance, state management.",
      icon: () => (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 24 17.6187)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 20.7935)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 8 20.7935)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 14.4062)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 8 14.4062)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 4.7998 17.6187)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 14.3994 17.6187)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.5996 20.7935)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 20.7998 20.7935)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.5996 14.4062)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 20.7998 14.4062)" fill="currentColor"/>
        </svg>
      )
    },
    {
      name: "Cosmos EVM",
      description: "Cosmos EVM enables plug-and-play EVM compatibility for Cosmos SDK chains. Run Solidity smart contracts, access Ethereum tooling, and leverage Cosmos modules like IBC within the EVM through precompiles and extensions. Deploy any Ethereum contract or implement new features beyond the standard EVM.",
      icon: () => (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 20.7998 17.6187)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 20.7935)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 14.4062)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 8 17.6187)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 14.4004 17.6187)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.6006 20.7935)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.6006 14.4062)" fill="currentColor"/>
        </svg>
      )
    },
    {
      name: "IBC Protocol",
      description: "The Inter-Blockchain Communication protocol (IBC) is a blockchain interoperability protocol enabling blockchains to safely transfer tokens, messages, and arbitrary data. Secure and flexible, IBC is designed to connect independent blockchains into a single interoperable network with configurable permissioning.",
      icon: () => (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 12.7937)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 19.2061)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 14.3994 22.406)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 24 12.7937)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 4.7998 12.7937)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.5996 12.7937)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.5996 19.2061)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 20.7998 15.9937)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 8 15.9937)" fill="currentColor"/>
        </svg>
      )
    },
    {
      name: "CometBFT",
      description: "CometBFT is the most widely-adopted, battle-tested consensus engine in blockchain. It is a Byzantine Fault Tolerant (BFT) middleware that takes a state transition machine—written in any programming language—and securely replicates it across many machines. Highly performant, CometBFT achieves speeds of up to 10,000 transactions per second (TPS). ",
      icon: () => (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 11.2)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 17.6123)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.6006 24)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 11.2002 24)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 20.7998 14.3999)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 20.7998 20.7876)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 8 14.4124)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 8 20.8)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.5996 11.2)" fill="currentColor"/>
          <rect width="3.19996" height="3.19996" transform="matrix(1 8.74228e-08 8.74228e-08 -1 17.6006 17.6123)" fill="currentColor" />
        </svg>
      )
    }
  ]

  const selectedTechData = technologies.find(tech => tech.name === selectedTech)

  return (
    <div className='w-full px-8 lg:px-12 lg:py-16'>
      <div className='w-full px-8 md:px-12 lg:px-24 py-12 md:py-20 lg:py-28 rounded-[24px] md:rounded-[32px] bg-[#F5F5F5] dark:bg-[#1E1F20]'>
        <div className='relative flex flex-col gap-12 md:gap-16 lg:gap-20 items-start justify-center'>
          <div className='flex flex-col gap-12 items-start justify-start w-full'>
            <p
              className='text-black/70 dark:text-[#CFDADC] text-md leading-relaxed tracking-wide'
              style={{ fontFeatureSettings: "'ss09' 1" }}
            >
              Learn More about the Cosmos Stack
            </p>

            <div className='flex gap-2 lg:gap-2 items-start flex-wrap justify-start w-full'>
              {technologies.map((tech, index) => (
                <TechPill
                  key={index}
                  name={tech.name}
                  icon={tech.icon}
                  isHighlighted={selectedTech === tech.name}
                  onClick={() => setSelectedTech(tech.name)}
                />
              ))}
            </div>
          </div>

          <p
            className='text-black/70 dark:text-[#CFDADC] text-md lg:text-lg leading-relaxed tracking-wide w-full whitespace-pre-wrap transition-opacity duration-300'
            style={{ fontFeatureSettings: "'ss09' 1, 'ss12' 1" }}
          >
            {selectedTechData?.description}
          </p>
        </div>
      </div>
    </div>
  )
}
