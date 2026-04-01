import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../auth/AuthProvider';
import {
  adminListCodes,
  adminGenerateCode,
  adminBlockCode,
  adminUnblockCode,
  adminUsageStats,
  checkAdmin,
} from '../lib/accessCodeService';

interface AdminCode {
  id: string;
  code: string;
  initial_credit: number;
  remaining_credit: number;
  redeemed_by: string | null;
  blocked: boolean;
  created_at: string;
  redeemed_at: string | null;
  usage: {
    total_cost: number;
    total_input: number;
    total_output: number;
    query_count: number;
    by_provider: Record<string, { cost: number; input_tokens: number; output_tokens: number; count: number }>;
  };
}

interface UsageStats {
  per_user: Array<{ user_id: string; email: string; total_cost: number; query_count: number; last_active: string }>;
  per_provider: Record<string, { total_cost: number; total_input: number; total_output: number; query_count: number }>;
}

export function Admin() {
  const navigate = useNavigate();
  const { session, isLoggedIn, isLoading } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [creditAmount, setCreditAmount] = useState(5);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check admin access
  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn || !session) {
      navigate('/');
      return;
    }
    checkAdmin(session).then(result => {
      setIsAdmin(result);
      if (!result) navigate('/');
    });
  }, [isLoggedIn, isLoading, session, navigate]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [codesData, usageData] = await Promise.all([
        adminListCodes(session),
        adminUsageStats(session),
      ]);
      setCodes(codesData.codes || []);
      setUsage(usageData);
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  const handleGenerate = async () => {
    if (!session) return;
    setGenerating(true);
    setGeneratedCode(null);
    try {
      const result = await adminGenerateCode(session, creditAmount);
      setGeneratedCode(result.code);
      refresh();
    } catch (err) {
      console.error('Generate failed', err);
    }
    setGenerating(false);
  };

  const handleToggleBlock = async (codeId: string, blocked: boolean) => {
    if (!session) return;
    try {
      if (blocked) {
        await adminUnblockCode(session, codeId);
      } else {
        await adminBlockCode(session, codeId);
      }
      refresh();
    } catch (err) {
      console.error('Block toggle failed', err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatus = (code: AdminCode) => {
    if (code.blocked) return { label: 'blocked', className: 'bg-error/10 text-error border-error/30' };
    if (code.remaining_credit <= 0) return { label: 'depleted', className: 'bg-text-secondary/10 text-text-secondary border-border' };
    if (!code.redeemed_by) return { label: 'unused', className: 'bg-accent/10 text-accent border-accent/30' };
    return { label: 'active', className: 'bg-success/10 text-success border-success/30' };
  };

  if (isLoading || isAdmin === null) {
    return <div className="h-screen flex items-center justify-center text-text-secondary text-sm">Loading...</div>;
  }

  // Stats
  const totalSpend = codes.reduce((sum, c) => sum + (c.usage?.total_cost || 0), 0);
  const activeCodes = codes.filter(c => !c.blocked && c.remaining_credit > 0 && c.redeemed_by).length;
  const totalUsers = new Set(codes.filter(c => c.redeemed_by).map(c => c.redeemed_by)).size;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h1 className="text-lg font-display font-bold text-text-primary">Argeon Admin</h1>
        <button onClick={() => navigate('/')} className="text-xs text-text-secondary hover:text-text-primary transition-colors">
          Back to app
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary mb-1">Total Spend</div>
            <div className="text-lg font-mono text-text-primary">${(Math.floor(totalSpend * 100) / 100).toFixed(2)}</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary mb-1">Active Codes</div>
            <div className="text-lg font-mono text-text-primary">{activeCodes}</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary mb-1">Total Users</div>
            <div className="text-lg font-mono text-text-primary">{totalUsers}</div>
          </div>
        </div>

        {/* Generate code */}
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">Generate Code</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-secondary">$</span>
              <input
                type="number"
                value={creditAmount}
                onChange={e => setCreditAmount(Math.max(0.01, Number(e.target.value)))}
                min="0.01"
                step="0.5"
                className="w-20 bg-bg border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
            {generatedCode && (
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm bg-bg border border-border rounded px-2 py-1 text-accent">
                  {generatedCode}
                </code>
                <button
                  onClick={() => handleCopy(generatedCode)}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Codes table */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">Access Codes</div>
          </div>
          {loading ? (
            <div className="p-4 text-xs text-text-secondary">Loading...</div>
          ) : codes.length === 0 ? (
            <div className="p-4 text-xs text-text-secondary">No codes yet. Generate your first code above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-bg/50">
                    <th scope="col" className="text-left px-4 py-2 text-text-secondary font-normal">Code</th>
                    <th scope="col" className="text-left px-4 py-2 text-text-secondary font-normal">Status</th>
                    <th scope="col" className="text-left px-4 py-2 text-text-secondary font-normal">User</th>
                    <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Balance</th>
                    <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Spent</th>
                    <th scope="col" className="text-left px-4 py-2 text-text-secondary font-normal">Created</th>
                    <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map(code => {
                    const status = getStatus(code);
                    const isExpanded = expandedCode === code.id;
                    return (
                      <React.Fragment key={code.id}>
                        <tr
                          className="border-b border-border/30 hover:bg-bg/30 cursor-pointer"
                          onClick={() => setExpandedCode(isExpanded ? null : code.id)}
                        >
                          <td className="px-4 py-2 font-mono">{code.code}</td>
                          <td className="px-4 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-text-secondary">{code.redeemed_by || '—'}</td>
                          <td className="px-4 py-2 text-right font-mono">
                            ${(Math.floor(Number(code.remaining_credit) * 100) / 100).toFixed(2)} / ${Number(code.initial_credit).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-text-secondary">
                            ${(code.usage?.total_cost || 0).toFixed(4)}
                          </td>
                          <td className="px-4 py-2 text-text-secondary">
                            {new Date(code.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleBlock(code.id, code.blocked); }}
                              className={`text-[10px] px-2 py-0.5 rounded ${
                                code.blocked
                                  ? 'text-success hover:bg-success/10'
                                  : 'text-error hover:bg-error/10'
                              }`}
                            >
                              {code.blocked ? 'Unblock' : 'Block'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && code.usage && Object.keys(code.usage.by_provider).length > 0 && (
                          <tr key={`${code.id}-detail`}>
                            <td colSpan={7} className="px-8 py-2 bg-bg/50">
                              <div className="text-[10px] text-text-secondary mb-1">Provider Breakdown</div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {Object.entries(code.usage.by_provider).map(([provider, stats]) => (
                                  <div key={provider} className="text-[10px] font-mono">
                                    <span className="text-text-secondary">{provider}:</span>{' '}
                                    <span className="text-text-primary">${stats.cost.toFixed(4)}</span>{' '}
                                    <span className="text-text-secondary">({stats.input_tokens + stats.output_tokens} tok)</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usage breakdown */}
        {usage && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Per-user */}
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-text-secondary">Per User</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-bg/50">
                      <th scope="col" className="text-left px-4 py-2 text-text-secondary font-normal">Email</th>
                      <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Spend</th>
                      <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Queries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.per_user.map(u => (
                      <tr key={u.user_id} className="border-b border-border/30">
                        <td className="px-4 py-2 text-text-secondary">{u.email}</td>
                        <td className="px-4 py-2 text-right font-mono">${u.total_cost.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right font-mono">{u.query_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-provider */}
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <div className="text-[10px] uppercase tracking-wider text-text-secondary">Per Provider</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-bg/50">
                      <th scope="col" className="text-left px-4 py-2 text-text-secondary font-normal">Provider</th>
                      <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Cost</th>
                      <th scope="col" className="text-right px-4 py-2 text-text-secondary font-normal">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usage.per_provider).map(([provider, stats]) => (
                      <tr key={provider} className="border-b border-border/30">
                        <td className="px-4 py-2 text-text-primary">{provider}</td>
                        <td className="px-4 py-2 text-right font-mono">${stats.total_cost.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right font-mono text-text-secondary">
                          {stats.total_input + stats.total_output}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
