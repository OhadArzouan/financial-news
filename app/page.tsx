'use client';

import { useState, useEffect } from 'react';
import { generateCsv, downloadCsv } from '../lib/export-utils';

interface FeedItem {
  id: number;
  title: string;
  url: string;
  description: string | null;
  content: string | null;
  processedContent: string | null;
  publishedAt: string;
  author: string | null;
  category: string | null;
}

interface Feed {
  id: number;
  title: string;
  url: string;
  description: string | null;
  items: FeedItem[];
}

interface SystemPrompt {
  id: string;
  name: string;
  prompt: string;
  temperature: number;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  id: string;
  content: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  systemPrompt: SystemPrompt;
}

type TabType = 'summaries' | 'feeds' | 'prompts';

type SortDirection = 'asc' | 'desc';
type SortField = 'datetime' | 'source';

type FeedItemWithSource = {
  item: FeedItem;
  feed: Feed;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('summaries');
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [promptForm, setPromptForm] = useState({
    name: '',
    prompt: '',
    temperature: 0.7
  });

  useEffect(() => {
    fetchFeeds();
    fetchSummaries();
    fetchSystemPrompts();
  }, []);

  const fetchSummaries = async () => {
    try {
      const response = await fetch('/api/summaries');
      const data = await response.json();
      if (response.ok) {
        setSummaries(data);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error fetching summaries:', error);
    }
  };

  const fetchSystemPrompts = async () => {
    try {
      const response = await fetch('/api/system-prompts');
      const data = await response.json();
      if (response.ok) {
        setSystemPrompts(data.systemPrompts);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error fetching system prompts:', error);
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/system-prompts', {
        method: editingPrompt ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...promptForm,
          id: editingPrompt?.id
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setShowPromptModal(false);
        setEditingPrompt(null);
        setPromptForm({ name: '', prompt: '', temperature: 0.7 });
        fetchSystemPrompts();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to save prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/system-prompts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSystemPrompts();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrompt = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setPromptForm({
      name: prompt.name,
      prompt: prompt.prompt,
      temperature: prompt.temperature,
    });
    setShowPromptModal(true);
  };

  const fetchFeeds = async () => {
    try {
      const response = await fetch('/api/feeds');
      const data = await response.json();
      if (response.ok) {
        setFeeds(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch feeds');
    }
  };

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: newFeedUrl }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setNewFeedUrl('');
        fetchFeeds();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const refreshFeeds = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch('/api/refresh');
      const data = await response.json();
      
      if (response.ok) {
        await fetchFeeds(); // Reload feeds after refresh
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to refresh feeds');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex justify-center bg-gray-100 py-8">
        <img src="/images/header.png" alt="RSS Feed Aggregator Header" className="h-32" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8">
        <div className="bg-white shadow-md overflow-hidden rounded-lg border border-gray-100">
          <div className="p-6">
            {/* Tabs */}
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('summaries')}
                className={`${activeTab === 'summaries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                Weekly Summaries
              </button>
              <button
                onClick={() => setActiveTab('feeds')}
                className={`${activeTab === 'feeds'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                RSS Feeds
              </button>
              <button
                onClick={() => setActiveTab('prompts')}
                className={`${activeTab === 'prompts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap pb-4 px-1 border-b-2 font-medium`}
              >
                System Prompts
              </button>
            </nav>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'prompts' && (
                <div className="space-y-6">
                  {showPromptModal && (
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
                      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
                        <h2 className="text-xl font-semibold mb-6">
                          {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
                        </h2>
                        <form onSubmit={handlePromptSubmit}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Name</h3>
                                <input
                                  type="text"
                                  id="name"
                                  value={promptForm.name}
                                  onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="Enter prompt name"
                                  required
                                />
                              </div>

                              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Temperature</h3>
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg text-gray-900">{promptForm.temperature}</span>
                                    <div className="flex-grow h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-blue-500 rounded-full" 
                                        style={{ width: `${promptForm.temperature * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    id="temperature"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={promptForm.temperature}
                                    onChange={(e) => setPromptForm({ ...promptForm, temperature: parseFloat(e.target.value) })}
                                    className="w-full"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Prompt Text</h3>
                              <textarea
                                id="prompt"
                                value={promptForm.prompt}
                                onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                                rows={12}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                                placeholder="Enter your prompt text"
                                required
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-3 mt-6">
                            <button
                              type="button"
                              onClick={() => setShowPromptModal(false)}
                              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                            >
                              {editingPrompt ? 'Save Changes' : 'Add Prompt'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="w-full space-y-4">
                      <h2 className="text-2xl font-bold text-gray-900">System Prompts</h2>
                      <div className="flex flex-col sm:flex-row gap-4 w-full">
                        <div className="flex-grow">
                          <label htmlFor="promptSelect" className="block text-sm font-medium text-gray-700 mb-2">
                            Select a Prompt
                          </label>
                          <select
                            id="promptSelect"
                            value={selectedPromptId}
                            onChange={(e) => {
                              setSelectedPromptId(e.target.value);
                              const selectedPrompt = systemPrompts.find(p => p.id === e.target.value);
                              if (selectedPrompt) {
                                setPromptForm({
                                  name: selectedPrompt.name,
                                  prompt: selectedPrompt.prompt,
                                  temperature: selectedPrompt.temperature
                                });
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select a prompt...</option>
                            {systemPrompts.map((prompt) => (
                              <option key={prompt.id} value={prompt.id}>
                                {prompt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 self-end">
                          <button
                            onClick={() => {
                              setEditingPrompt(null);
                              setPromptForm({ name: '', prompt: '', temperature: 0.7 });
                              setSelectedPromptId('');
                              setShowPromptModal(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 shadow-sm"
                          >
                            Add New
                          </button>
                          {selectedPromptId && (
                            <>
                              <button
                                onClick={() => {
                                  const prompt = systemPrompts.find(p => p.id === selectedPromptId);
                                  if (prompt) handleEditPrompt(prompt);
                                }}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200 shadow-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePrompt(selectedPromptId)}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 shadow-sm"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-md">
                      {error}
                    </div>
                  )}

                  {selectedPromptId && (
                    <div className="mt-6 space-y-6">
                      {systemPrompts
                        .filter(prompt => prompt.id === selectedPromptId)
                        .map(prompt => (
                          <div key={prompt.id} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Name</h3>
                                <p className="text-lg text-gray-900">{prompt.name}</p>
                              </div>

                              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Temperature</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg text-gray-900">{prompt.temperature}</span>
                                  <div className="flex-grow h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 rounded-full" 
                                      style={{ width: `${prompt.temperature * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Prompt Text</h3>
                              <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-md h-[calc(100%-3rem)] overflow-auto">
                                <pre className="whitespace-pre-wrap">{prompt.prompt}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'feeds' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <form onSubmit={addFeed} className="flex gap-2">
                        <input
                          type="url"
                          value={newFeedUrl}
                          onChange={(e) => setNewFeedUrl(e.target.value)}
                          placeholder="Enter RSS feed URL"
                          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 shadow-sm"
                        >
                          Add Feed
                        </button>
                      </form>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const items = feeds.flatMap(feed =>
                            feed.items.map(item => ({ item, feed }))
                          );
                          const csv = generateCsv(items);
                          downloadCsv(csv, `feed-items-${new Date().toISOString().split('T')[0]}.csv`);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200 flex items-center gap-2 shadow-sm"
                      >
                        Export to CSV
                      </button>
                      <button
                        onClick={refreshFeeds}
                        disabled={isRefreshing}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors duration-200 flex items-center gap-2 shadow-sm"
                      >
                        {isRefreshing ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Refreshing...
                          </>
                        ) : (
                          'Refresh All Feeds'
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 items-center border-t border-gray-100 pt-6">
                    <div className="w-full sm:w-auto flex flex-wrap gap-4">
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </select>
                      <input
                        type="text"
                        value={feedFilter}
                        onChange={(e) => setFeedFilter(e.target.value)}
                        placeholder="Filter by title or content..."
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Feed Items Table */}
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title & Author</th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {feeds
                          .flatMap(feed =>
                            feed.items.map(item => ({
                              feed,
                              item,
                              searchText: `${item.title} ${item.description || ''} ${item.content || ''} ${item.processedContent || ''}`.toLowerCase()
                            }))
                          )
                          .filter(({ searchText }) =>
                            !feedFilter || searchText.includes(feedFilter.toLowerCase())
                          )
                          .sort((a, b) => {
                            const dateA = new Date(a.item.publishedAt).getTime();
                            const dateB = new Date(b.item.publishedAt).getTime();
                            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                          })
                          .map(({ feed, item }) => (
                            <tr key={item.id}>
                              <td className="px-6 py-4 whitespace-normal">
                                <div className="text-sm text-gray-900">{feed.title}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-normal">
                                <time dateTime={item.publishedAt} className="text-sm text-gray-900">
                                  {new Date(item.publishedAt).toLocaleString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                  })}
                                </time>
                              </td>
                              <td className="px-6 py-4 whitespace-normal">
                                <div>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline block mb-1"
                                  >
                                    {item.title}
                                  </a>
                                  <div className="text-xs text-gray-500">
                                    {item.author && <span>By {item.author}</span>}
                                    {item.category && (
                                      <span className="ml-2 px-2 py-1 bg-gray-100 rounded-full">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-normal">
                                {item.description && (
                                  <div className="text-sm text-gray-900">{item.description}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-normal">
                                {item.processedContent ? (
                                  <div className="text-sm text-gray-900 whitespace-pre-line">
                                    {item.processedContent}
                                  </div>
                                ) : item.content ? (
                                  <div
                                    className="text-sm text-gray-900 prose max-w-none"
                                    dangerouslySetInnerHTML={{ __html: item.content }}
                                  />
                                ) : null}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
