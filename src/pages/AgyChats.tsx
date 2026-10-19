import { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Copy,
  Check,
  Search,
  FolderOpen,
  RefreshCw,
  Clock
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { copyToClipboard } from '../utils/clipboard';

interface AgySessionItem {
  conversation_id: string;
  title: string;
  preview: string;
  step_count: number;
  last_modified_time: string;
  workspace: string;
  agent_name?: string;
  nesting_depth: number;
}

export default function AgyChats() {
  const [sessions, setSessions] = useState<AgySessionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('ALL');

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const items = await invoke<AgySessionItem[]>('get_agy_sessions', {
        limit: 100,
        search: searchQuery.trim() ? searchQuery.trim() : null,
        all: showAll,
      });
      setSessions(items);
    } catch (err) {
      console.error('Failed to load Antigravity sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [searchQuery, showAll]);

  const handleResume = async (session: AgySessionItem) => {
    setStatusMsg(`Resuming session in ${session.workspace || 'default workspace'}...`);
    try {
      const res = await invoke<string>('resume_agy_session', {
        conversationId: session.conversation_id,
        workspace: session.workspace || null,
      });
      setStatusMsg(res);
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to resume Antigravity session:', err);
      setStatusMsg(`Error: ${err.toString()}`);
    }
  };

  const handleCopyCmd = async (id: string) => {
    const cmd = `agy --conversation ${id}`;
    await copyToClipboard(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Extract unique workspaces for filtering
  const workspaces = Array.from(
    new Set(sessions.map((s) => s.workspace).filter(Boolean))
  );

  const filteredSessions = sessions.filter((s) => {
    if (selectedWorkspace !== 'ALL' && s.workspace !== selectedWorkspace) {
      return false;
    }
    return true;
  });

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-base-100 text-base-content">
      {/* Top Header & Toolbar */}
      <div className="p-4 border-b border-base-200 bg-base-200/40 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide">AGy-chats Suite</h2>
                <span className="badge badge-xs badge-outline font-mono text-[10px]">
                  E:\02_Projects\agy-chats
                </span>
              </div>
              <p className="text-[11px] text-base-content/60">
                Browse, search, resume, and inspect Antigravity agent conversations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSessions}
              disabled={isLoading}
              className="btn btn-sm btn-ghost btn-square"
              title="Refresh Sessions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-base-content/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversation titles, prompts, or workspaces..."
                className="input input-sm input-bordered w-full pl-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Workspace Filter */}
            <div className="flex items-center gap-1.5 bg-base-100 px-2.5 py-1 rounded-lg border border-base-300 text-xs">
              <FolderOpen className="w-3.5 h-3.5 text-base-content/60" />
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="bg-transparent font-mono text-xs outline-none cursor-pointer max-w-[160px] truncate"
              >
                <option value="ALL">All Workspaces</option>
                {workspaces.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Subagents Toggle */}
            <label className="label cursor-pointer gap-1.5 bg-base-100 px-2.5 py-1 rounded-lg border border-base-300 text-xs">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="checkbox checkbox-xs checkbox-primary"
              />
              <span className="text-[11px]">Include Subagents (-a)</span>
            </label>
          </div>
        </div>

        {statusMsg && (
          <div className="text-[11px] font-mono text-info flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Main Sessions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredSessions.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-base-content/50 text-xs">
            <Bot className="w-8 h-8 opacity-40 mb-2" />
            <span>No Antigravity conversations found matching search criteria</span>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.conversation_id}
              className="p-3.5 rounded-xl bg-base-200/50 hover:bg-base-200 border border-base-300 transition-all flex flex-col gap-2 group shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-base-content truncate max-w-md">
                    {session.title || 'Untitled Session'}
                  </span>
                  {session.nesting_depth > 0 && (
                    <span className="badge badge-xs badge-ghost text-[10px]">
                      Subagent (depth {session.nesting_depth})
                    </span>
                  )}
                  {session.step_count > 0 && (
                    <span className="badge badge-xs badge-primary/20 text-primary font-mono text-[10px]">
                      {session.step_count} steps
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-base-content/60 font-mono">
                    {formatRelativeTime(session.last_modified_time)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyCmd(session.conversation_id)}
                      className="btn btn-xs btn-ghost gap-1"
                      title="Copy Resume Command"
                    >
                      {copiedId === session.conversation_id ? (
                        <>
                          <Check className="w-3 h-3 text-success" />
                          <span className="text-success text-[10px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleResume(session)}
                      className="btn btn-xs btn-primary gap-1 shadow-sm"
                      title="Resume in Terminal"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span className="text-[10px]">Resume agy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Workspace Badge */}
              {session.workspace && (
                <div className="flex items-center gap-1.5 text-[11px] text-base-content/60 font-mono">
                  <FolderOpen className="w-3 h-3 shrink-0" />
                  <span className="truncate">{session.workspace}</span>
                </div>
              )}

              {/* Prompt / Preview */}
              {session.preview && (
                <div className="text-xs text-base-content/80 font-mono bg-base-100/70 p-2 rounded-lg border border-base-300/50 line-clamp-2 select-text">
                  {session.preview}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
