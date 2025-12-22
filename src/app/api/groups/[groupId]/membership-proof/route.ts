/**
 * API Endpoint: Generate Membership Proof Signature
 * 
 * POST /api/groups/[groupId]/membership-proof
 * 
 * Verifies user is a member of the group in Supabase,
 * then generates a signed attestation for on-chain verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateMembershipProof } from '@/lib/signature-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId: groupIdParam } = await params;
    const body = await request.json();
    const { walletAddress } = body;

    // Validate inputs
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing walletAddress' },
        { status: 400 }
      );
    }

    const groupId = parseInt(groupIdParam, 10);
    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'Invalid groupId' },
        { status: 400 }
      );
    }

    // Check backend private key is configured
    const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
    if (!privateKey) {
      console.error('[MembershipProof] BACKEND_SIGNER_PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify group exists in Supabase
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      console.log(`[MembershipProof] Group ${groupId} not found`);
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Verify user is a member
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (membershipError || !membership) {
      console.log(`[MembershipProof] User ${walletAddress} not a member of group ${groupId}`);
      return NextResponse.json(
        { error: 'Not a member of this group' },
        { status: 403 }
      );
    }

    // Generate signature (1 hour expiration)
    const proof = generateMembershipProof(
      privateKey,
      walletAddress,
      groupId,
      60 // 60 minutes
    );

    console.log(`[MembershipProof] Generated signature for ${walletAddress.slice(0, 10)}... in group ${groupId} (${group.name})`);

    return NextResponse.json(proof);
  } catch (error) {
    console.error('[MembershipProof] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

