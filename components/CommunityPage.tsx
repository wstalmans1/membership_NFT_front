'use client';

import { useState, useEffect } from 'react';
import { NFTMetadata, getAllMembers } from '@/lib/metadata';
import { NFTDisplay } from './NFTDisplay';

export function CommunityPage() {
  const [allMembers, setAllMembers] = useState<Array<{ tokenId: number; metadata: NFTMetadata; ownerAddress: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const members = await getAllMembers();
        setAllMembers(members);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-8 w-full min-w-0 overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Community</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {isLoading ? 'Loading members…' : `${allMembers.length} member${allMembers.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Loading members…</p>
          </div>
        </div>
      ) : allMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {allMembers.map((member) => (
            <NFTDisplay
              key={member.tokenId}
              tokenId={member.tokenId}
              ownerAddress={member.ownerAddress}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No members yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
