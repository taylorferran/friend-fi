'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CONTRACT_ADDRESS, MODULE_NAME } from '@/lib/contract';

const INDEXER_URL = 'https://indexer.testnet.movementnetwork.xyz/v1/graphql';

interface TestResult {
  name: string;
  duration: number;
  success: boolean;
  data?: unknown;
  error?: string;
}

export default function DebugPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTest = async (name: string, fn: () => Promise<unknown>): Promise<TestResult> => {
    const start = performance.now();
    try {
      const data = await fn();
      const duration = performance.now() - start;
      return { name, duration, success: true, data };
    } catch (error) {
      const duration = performance.now() - start;
      return { 
        name, 
        duration, 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  };

  const executeQuery = async (query: string, variables?: Record<string, unknown>) => {
    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result.errors) {
      throw new Error(JSON.stringify(result.errors));
    }
    return result.data;
  };

  const runAllTests = async () => {
    setRunning(true);
    setResults([]);
    const testResults: TestResult[] = [];

    // Test 1: Basic connectivity
    testResults.push(await runTest('1. Basic Ping', async () => {
      const query = `query { __typename }`;
      return await executeQuery(query);
    }));
    setResults([...testResults]);

    // Test 2: Check available tables (introspection)
    testResults.push(await runTest('2. Schema Check', async () => {
      const query = `
        query {
          __schema {
            queryType {
              fields(includeDeprecated: false) {
                name
              }
            }
          }
        }
      `;
      const data = await executeQuery(query);
      const fields = data.__schema?.queryType?.fields?.map((f: {name: string}) => f.name) || [];
      return { availableTables: fields.slice(0, 20), total: fields.length };
    }));
    setResults([...testResults]);

    // Test 3: USDC Balance Query
    testResults.push(await runTest('3. USDC Balance Query', async () => {
      const query = `
        query GetBalances {
          current_fungible_asset_balances(limit: 5) {
            owner_address
            asset_type
            amount
          }
        }
      `;
      return await executeQuery(query);
    }));
    setResults([...testResults]);

    // Test 4: Check if events table exists
    testResults.push(await runTest('4. Events Table Check', async () => {
      const query = `
        query {
          events(limit: 5) {
            type
            data
            transaction_version
          }
        }
      `;
      return await executeQuery(query);
    }));
    setResults([...testResults]);

    // Test 5: SKIPPED - takes 29+ seconds
    testResults.push({
      name: '5. GroupCreatedEvent Query (SKIPPED)',
      duration: 0,
      success: true,
      data: 'Skipped - event type filter queries take 29+ seconds. The indexer needs an index on event type.'
    });
    setResults([...testResults]);

    // Test 6: SKIPPED - slow
    testResults.push({
      name: '6. Module Events Table (SKIPPED)',
      duration: 0,
      success: true,
      data: 'Skipped - same issue as test 5'
    });
    setResults([...testResults]);

    // Test 7: SKIPPED - takes 60+ seconds
    testResults.push({
      name: '7. All Contract Events (SKIPPED)',
      duration: 0,
      success: true,
      data: 'Skipped - event type queries take 60+ seconds'
    });
    setResults([...testResults]);

    // Test 8: Recent transactions (no filter - fast)
    testResults.push(await runTest('8. Recent Transactions', async () => {
      const query = `
        query {
          events(
            order_by: { transaction_version: desc }
            limit: 5
          ) {
            type
            transaction_version
          }
        }
      `;
      return await executeQuery(query);
    }));
    setResults([...testResults]);

    // Test 9: Account transactions (might be faster than event type filter)
    testResults.push(await runTest('9. Account Transactions', async () => {
      const query = `
        query GetAccountTx($account: String!) {
          account_transactions(
            where: { account_address: { _eq: $account } }
            order_by: { transaction_version: desc }
            limit: 10
          ) {
            transaction_version
          }
        }
      `;
      return await executeQuery(query, { account: CONTRACT_ADDRESS });
    }));
    setResults([...testResults]);

    // Test 10: User's specific USDC balance
    testResults.push(await runTest('10. Your USDC Balance', async () => {
      const userAddress = '0x3bbf63d6c675ae02f724c823c9cc42bf51aa2a504e4373998be7aa148b8ff2c2';
      const query = `
        query GetUserBalance($owner: String!) {
          current_fungible_asset_balances(
            where: {
              owner_address: { _eq: $owner }
            }
          ) {
            asset_type
            amount
          }
        }
      `;
      return await executeQuery(query, { owner: userAddress });
    }));
    setResults([...testResults]);

    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-text text-3xl font-display font-bold mb-2">Indexer Debug</h1>
        <p className="text-accent font-mono text-sm mb-6">
          Testing: {INDEXER_URL}
        </p>
        <p className="text-accent font-mono text-xs mb-6">
          Contract: {CONTRACT_ADDRESS}::{MODULE_NAME}
        </p>

        <Button onClick={runAllTests} disabled={running} className="mb-6">
          {running ? 'Running Tests...' : 'Run All Tests'}
        </Button>

        <div className="space-y-4">
          {results.map((result, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-text font-mono font-bold">{result.name}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-accent font-mono text-sm">
                      {result.duration.toFixed(0)}ms
                    </span>
                    <span className={`px-2 py-1 text-xs font-mono font-bold ${
                      result.success 
                        ? 'bg-green-600/20 text-green-600' 
                        : 'bg-red-600/20 text-red-600'
                    }`}>
                      {result.success ? 'OK' : 'FAIL'}
                    </span>
                  </div>
                </div>
                
                <pre className="text-xs font-mono bg-background p-3 overflow-x-auto max-h-60 overflow-y-auto border border-text/20">
                  {result.error 
                    ? `Error: ${result.error}`
                    : JSON.stringify(result.data, null, 2)
                  }
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        {results.length > 0 && (
          <div className="mt-8 p-4 bg-surface border-2 border-text">
            <h3 className="text-text font-mono font-bold mb-2">Summary</h3>
            <p className="text-accent font-mono text-sm">
              Total tests: {results.length} | 
              Passed: {results.filter(r => r.success).length} | 
              Failed: {results.filter(r => !r.success).length} |
              Avg time: {(results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(0)}ms
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

