'use client';

import { useEffect, useState } from 'react';
import { getMetadata, NFTMetadata } from '@/lib/metadata';
import { CONTRACTS } from '@/config/contracts';
import { QRCodeSVG } from 'qrcode.react';

interface NFTDisplayProps {
  tokenId: number;
  ownerAddress: string;
}

export function NFTDisplay({ tokenId, ownerAddress }: NFTDisplayProps) {
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        setLoading(true);
        setError(null);
        console.log('🔍 NFTDisplay: Fetching metadata for tokenId:', tokenId);
        const data = await getMetadata(tokenId);
        console.log('✅ NFTDisplay: Metadata fetched:', data);
        if (!data) {
          console.warn('⚠️ NFTDisplay: No metadata found for tokenId:', tokenId);
          setError(`No metadata found for token ID ${tokenId}. The metadata may not have been set up yet.`);
        } else {
          setMetadata(data);
        }
      } catch (err: any) {
        console.error('❌ NFTDisplay: Error fetching metadata:', err);
        setError(err.message || 'Failed to load NFT metadata');
      } finally {
        setLoading(false);
      }
    }

    if (tokenId) {
      fetchMetadata();
    }
  }, [tokenId]);

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
          No metadata found for this NFT. The metadata may not have been set up yet.
        </p>
      </div>
    );
  }

  const properties = metadata.properties || {};
  const attributes = metadata.attributes || [];
  
  // Format dates
  const issuedDate = properties.issuedDate 
    ? new Date(properties.issuedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  
  const dateOfBirth = properties.dateOfBirth || null;
  
  // Generate ID format: WC-YYYY-TTTT-HONOR (WC = World Citizen, YYYY = Year, TTTT = Token ID padded)
  const cardId = `WC-${new Date().getFullYear()}-${tokenId.toString().padStart(4, '0')}-HONOR`;

  return (
    <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 rounded shadow-2xl overflow-hidden border border-cyan-400/50 mx-auto flex flex-col" style={{
      boxShadow: '0 0 20px rgba(34, 211, 238, 0.3), inset 0 0 20px rgba(34, 211, 238, 0.1)',
      width: '110mm', // Increased from 85.60mm (about 28% larger)
      height: '72mm', // Slightly taller to accommodate content
      maxWidth: '100%', // Responsive fallback
      aspectRatio: '85.60 / 53.98' // Maintain aspect ratio
    }}>
      {/* Glowing border effect */}
      <div className="absolute inset-0 rounded" style={{
        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.05) 100%)',
        border: '1px solid rgba(34, 211, 238, 0.3)'
      }} />
      
      <div className="relative p-1.5 h-full flex flex-col justify-center">
        {/* Header Section - Optimized */}
        <div className="flex items-center gap-1 mb-1.5">
          {/* International/UN flag */}
          <div className="relative w-10 h-7 rounded overflow-hidden shadow flex-shrink-0">
            <div 
              className="w-full h-full rounded-sm"
              style={{ 
                backgroundColor: '#5B92E5' // Pantone 2925 UN Blue
              }}
            >
              {/* Recognizable world map - using SVG for accuracy */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 70" preserveAspectRatio="none">
                {/* Continents in white - simplified but recognizable shapes */}
                {/* North America */}
                <path d="M 8 12 L 12 10 L 18 8 L 22 10 L 24 15 L 23 20 L 20 22 L 15 20 L 10 18 Z" fill="white" opacity="0.9"/>
                {/* South America */}
                <path d="M 12 28 L 16 26 L 18 30 L 17 45 L 14 48 L 11 45 L 10 35 Z" fill="white" opacity="0.9"/>
                {/* Europe */}
                <path d="M 28 15 L 32 14 L 34 18 L 32 22 L 28 20 Z" fill="white" opacity="0.9"/>
                {/* Africa */}
                <path d="M 32 18 L 36 16 L 38 20 L 37 45 L 34 48 L 31 45 L 30 35 Z" fill="white" opacity="0.9"/>
                {/* Asia */}
                <path d="M 38 10 L 50 8 L 58 12 L 60 18 L 58 25 L 55 28 L 50 26 L 45 22 L 40 18 Z" fill="white" opacity="0.9"/>
                {/* Middle East / Arabian Peninsula */}
                <path d="M 42 22 L 46 20 L 48 24 L 46 28 L 42 26 Z" fill="white" opacity="0.9"/>
                {/* India */}
                <path d="M 50 28 L 54 26 L 56 32 L 54 36 L 50 34 Z" fill="white" opacity="0.9"/>
                {/* Southeast Asia */}
                <path d="M 58 30 L 62 28 L 64 32 L 62 36 L 58 34 Z" fill="white" opacity="0.9"/>
                {/* Australia */}
                <path d="M 62 48 L 68 46 L 70 50 L 68 54 L 64 52 Z" fill="white" opacity="0.9"/>
                {/* Japan */}
                <path d="M 70 20 L 72 18 L 74 22 L 72 24 L 70 22 Z" fill="white" opacity="0.9"/>
                {/* Greenland */}
                <path d="M 20 5 L 24 4 L 26 8 L 24 12 L 20 10 Z" fill="white" opacity="0.9"/>
              </svg>
              {/* Olive branches on sides */}
              <div className="absolute top-0 left-0.5 text-white z-10" style={{ fontSize: '5px' }}>🌿</div>
              <div className="absolute top-0 right-0.5 text-white z-10" style={{ fontSize: '5px' }}>🌿</div>
            </div>
          </div>

          {/* Plus sign */}
          <div className="text-cyan-300 font-bold text-xs flex-shrink-0">+</div>

          {/* Palestinian flag */}
          <div className="relative w-10 h-7 rounded overflow-hidden shadow flex-shrink-0">
            <div className="relative w-full h-full">
              {/* Three equal horizontal stripes: black, white, green */}
              <div className="absolute inset-0 flex flex-col">
                <div className="flex-1" style={{ backgroundColor: '#000000' }}></div>
                <div className="flex-1" style={{ backgroundColor: '#FFFFFF' }}></div>
                <div className="flex-1" style={{ backgroundColor: '#009736' }}></div>
              </div>
              {/* Red triangle extending from the hoist (left) side - overlaying the stripes */}
              {/* Triangle: base on left edge (full height), apex at right side center (1/3 width) */}
              <div 
                className="absolute inset-0"
                style={{
                  background: '#EE2A35',
                  clipPath: 'polygon(0 0, 0 100%, 33.33% 50%)',
                  zIndex: 10
                }}
              />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-cyan-300 leading-tight">World Citizen for Palestine</h2>
            <p className="text-sm font-bold text-cyan-200/80 mt-0.5 block text-left leading-tight" dir="rtl" style={{ textAlign: 'left' }}>مواطن عالمي من أجل فلسطين</p>
          </div>
        </div>

        {/* Main Content Grid - Optimized spacing */}
        <div className="grid grid-cols-3 gap-2">
          {/* Left Column - Personal Info */}
          <div className="col-span-2 space-y-1">
            {/* ID Number - NFT URL */}
            <div>
              <p className="text-[9px] text-cyan-300/70 uppercase tracking-wider mb-0.5 leading-tight">ID</p>
              <a
                href={`https://eth-sepolia.blockscout.com/token/${CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}/instance/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] font-mono text-cyan-200 break-all hover:text-cyan-100 hover:underline leading-tight block"
              >
                https://eth-sepolia.blockscout.com/token/{CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}/instance/{tokenId}
              </a>
            </div>

            {/* Name */}
            {properties.name && (
              <div>
                <p className="text-xs text-cyan-300/70 uppercase tracking-wider mb-0.5 leading-tight">NAME</p>
                <p className="text-base font-semibold text-white leading-tight">{properties.name}</p>
              </div>
            )}

            {/* Address - Below name */}
            <div>
              <p className="text-[10px] text-cyan-300/70 leading-tight mb-0.5">
                Address:
              </p>
              <a
                href={`https://eth-sepolia.blockscout.com/address/${ownerAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-cyan-200 break-all hover:text-cyan-100 hover:underline block leading-tight"
              >
                {ownerAddress}
              </a>
            </div>

            {/* Born */}
            {dateOfBirth && (
              <div>
                <p className="text-xs text-cyan-300/70 uppercase tracking-wider mb-0.5 leading-tight">BORN</p>
                <p className="text-sm text-cyan-100 leading-tight">{dateOfBirth}</p>
              </div>
            )}

            {/* Issued Date */}
            {issuedDate && (
              <div>
                <p className="text-xs text-cyan-300/70 uppercase tracking-wider mb-0.5 leading-tight">ISSUED</p>
                <p className="text-sm text-cyan-100 leading-tight">{issuedDate}</p>
              </div>
            )}
          </div>

          {/* Right Column - Photo and QR Code */}
          <div className="col-span-1 flex flex-col items-center gap-1">
            {metadata.image ? (
              <div className="w-2/3 aspect-[3/4] bg-white rounded overflow-hidden border border-cyan-300/50 shadow-sm">
                <img
                  src={metadata.image}
                  alt={properties.name || 'Member Photo'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-2/3 aspect-[3/4] bg-gradient-to-br from-cyan-900 to-blue-900 rounded border border-cyan-300/50 shadow-sm flex items-center justify-center">
                <p className="text-cyan-300/50 text-xs">No Photo</p>
              </div>
            )}

            {/* QR Code - Scannable */}
            <a
              href={`https://eth-sepolia.blockscout.com/token/${CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}/instance/${tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-2/3 aspect-square rounded flex items-center justify-center hover:opacity-80 transition-all cursor-pointer"
            >
              <QRCodeSVG
                value={`https://eth-sepolia.blockscout.com/token/${CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}/instance/${tokenId}`}
                size={50}
                level="M"
                includeMargin={false}
                fgColor="#06b6d4"
                bgColor="transparent"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

