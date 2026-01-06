import { NextRequest, NextResponse } from 'next/server';
import { getMetadata } from '@/lib/metadata';

/**
 * API Route: GET /api/metadata/[tokenId]
 * 
 * This endpoint serves NFT metadata from Supabase.
 * It's called by wallets/marketplaces when they query tokenURI() from the contract.
 * 
 * The contract's baseURI should be set to: https://your-domain.com/api/metadata/
 * So tokenURI(1) returns: https://your-domain.com/api/metadata/1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } }
) {
  try {
    const tokenId = parseInt(params.tokenId);

    if (isNaN(tokenId) || tokenId <= 0) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    // Fetch metadata from Supabase
    const metadata = await getMetadata(tokenId);

    if (!metadata) {
      return NextResponse.json(
        { error: 'Metadata not found' },
        { status: 404 }
      );
    }

    // Return metadata as JSON
    // This is what wallets/marketplaces expect (ERC-721 metadata standard)
    return NextResponse.json(metadata, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow CORS for wallets/marketplaces
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error: any) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

