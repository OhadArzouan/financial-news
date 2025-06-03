'use client';

import React, { useState, useEffect } from 'react';

type TabType = 'feeds' | 'summaries' | 'prompts';

interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  processedContent?: string;
  author?: string;
  category?: string;
  feedId: string;
}

interface Feed {
  id: string;
  title: string;
  url: string;
  last_fetched: string;
  items: FeedItem[];
}

interface SystemPrompt {
  id: string;
  name: string;
  prompt: string;
  temperature: number;
  created_at: string;
}

interface Summary {
  id: string;
  week: string;
  content: string;
  created_at: string;
}

interface PromptForm {
  name: string;
  prompt: string;
  temperature: number;
}

type SortDirection = 'asc' | 'desc';
type SortField = 'publishedAt' | 'feedTitle';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('feeds');
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [promptForm, setPromptForm] = useState<PromptForm>({
    name: '',
    prompt: '',
    temperature: 0.7,
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortField, setSortField] = useState<SortField>('publishedAt');
  const [feedFilter, setFeedFilter] = useState<string>('all');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchFeeds();
      fetchSummaries();
      fetchSystemPrompts();
    }
  }, [isMounted]);

  const fetchFeeds = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/feeds');
      if (!response.ok) throw new Error('Failed to fetch feeds');
      const data = await response.json();
      setFeeds(data);
    } catch (err) {
      console.error('Error fetching feeds:', err);
      setError('Failed to fetch feeds');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummaries = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/summaries');
      if (!response.ok) throw new Error('Failed to fetch summaries');
      const data = await response.json();
      setSummaries(data.summaries);
    } catch (err) {
      console.error('Error fetching summaries:', err);
      setError('Failed to fetch summaries');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemPrompts = async () => {
    try {
      const response = await fetch('/api/system-prompts');
      if (!response.ok) {
        throw new Error('Failed to fetch system prompts');
      }
      const data = await response.json();
      setSystemPrompts(data.systemPrompts);
    } catch (err) {
      console.error('Error fetching system prompts:', err);
      setError('Failed to fetch system prompts');
    }
  };

  const handleAddFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newFeedUrl }),
      });
      if (!response.ok) {
        throw new Error('Failed to add feed');
      }
      await fetchFeeds();
      setNewFeedUrl('');
    } catch (err) {
      console.error('Error adding feed:', err);
      setError('Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshFeeds = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/refresh', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh feeds');
      }
      await fetchFeeds();
    } catch (err) {
      console.error('Error refreshing feeds:', err);
      setError('Failed to refresh feeds');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = editingPrompt ? `/api/system-prompts/${editingPrompt.id}` : '/api/system-prompts';
      const method = editingPrompt ? 'PUT' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptForm),
      });
      if (!response.ok) {
        throw new Error('Failed to save prompt');
      }
      await fetchSystemPrompts();
      setShowPromptModal(false);
      setPromptForm({ name: '', prompt: '', temperature: 0.7 });
      setEditingPrompt(null);
    } catch (err) {
      console.error('Error saving prompt:', err);
      setError('Failed to save prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/system-prompts/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete prompt');
      }
      await fetchSystemPrompts();
    } catch (err) {
      console.error('Error deleting prompt:', err);
      setError('Failed to delete prompt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">RSS Feed Aggregator</h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="bg-white shadow-sm rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('feeds')}
                className={`${activeTab === 'feeds' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Feeds
              </button>
              <button
                onClick={() => setActiveTab('summaries')}
                className={`${activeTab === 'summaries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Summaries
              </button>
              <button
                onClick={() => setActiveTab('prompts')}
                className={`${activeTab === 'prompts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                System Prompts
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'feeds' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">RSS Feeds</h2>
                  <div className="flex space-x-4">
                    <button
                      onClick={handleRefreshFeeds}
                      disabled={isRefreshing}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isRefreshing ? 'Refreshing...' : 'Refresh Feeds'}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddFeed} className="mb-6">
                  <div className="flex gap-4">
                    <input
                      type="url"
                      value={newFeedUrl}
                      onChange={(e) => setNewFeedUrl(e.target.value)}
                      placeholder="Enter RSS feed URL"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? 'Adding...' : 'Add Feed'}
                    </button>
                  </div>
                </form>

                <div className="mt-8 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                  {/* Unified Feed Items Table */}
                  <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
                    <h3 className="text-lg font-medium text-gray-900">All Feed Items</h3>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div>
                          <label htmlFor="feedFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Feed</label>
                          <select
                            id="feedFilter"
                            value={feedFilter}
                            onChange={(e) => setFeedFilter(e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                          >
                            <option value="all">All Feeds</option>
                            {feeds.map((feed) => (
                              <option key={feed.id} value={feed.id}>{feed.title}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="sortField" className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                          <div className="flex items-center gap-2">
                            <select
                              id="sortField"
                              value={sortField}
                              onChange={(e) => setSortField(e.target.value as SortField)}
                              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                              <option value="publishedAt">Date</option>
                              <option value="feedTitle">Feed Name</option>
                            </select>
                            
                            <button
                              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                              aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
                            >
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Feed</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">Title</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6">Content</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Published</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {feeds
                          .filter(feed => feedFilter === 'all' || feed.id === feedFilter)
                          .flatMap(feed => feed.items.map(item => ({ ...item, feedTitle: feed.title, feedId: feed.id })))
                          .sort((a, b) => {
                            if (sortField === 'publishedAt') {
                              return sortDirection === 'asc' 
                                ? new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
                                : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
                            } else { // feedTitle
                              return sortDirection === 'asc'
                                ? a.feedTitle.localeCompare(b.feedTitle)
                                : b.feedTitle.localeCompare(a.feedTitle);
                            }
                          })
                          .map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {item.feedTitle}
                              </td>
                              <td className="px-3 py-2">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {item.title}
                                </a>
                              </td>
                              <td className="px-3 py-2">
                                <div 
                                  className="text-sm text-gray-600 overflow-y-auto p-1 rounded bg-gray-50" 
                                  style={{ height: '200px', overflowY: 'auto', display: 'block' }}
                                >
                                  {item.processedContent || '-'}
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {new Date(item.publishedAt).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {item.category || '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'summaries' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Weekly Summaries</h2>
                </div>

                <div className="space-y-6">
                  {summaries.map((summary) => (
                    <div key={summary.id} className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                      <div className="prose prose-sm max-w-none">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Week of {new Date(summary.week).toLocaleDateString()}
                        </h3>
                        <div className="whitespace-pre-wrap">{summary.content}</div>
                        <div className="text-sm text-gray-500 mt-4">
                          Created: {new Date(summary.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'prompts' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">System Prompts</h2>
                  <button
                    onClick={() => {
                      setEditingPrompt(null);
                      setPromptForm({ name: '', prompt: '', temperature: 0.7 });
                      setShowPromptModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Add New Prompt
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {systemPrompts.map((prompt) => (
                    <div key={prompt.id} className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{prompt.name}</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Temperature: {prompt.temperature}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setPromptForm({
                                name: prompt.name,
                                prompt: prompt.prompt,
                                temperature: prompt.temperature,
                              });
                              setEditingPrompt(prompt);
                              setShowPromptModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(prompt.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 bg-gray-50 rounded-md p-4">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700">{prompt.prompt}</pre>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Created: {new Date(prompt.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
            </h2>
            <form onSubmit={handlePromptSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={promptForm.name}
                    onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                    Prompt
                  </label>
                  <textarea
                    id="prompt"
                    value={promptForm.prompt}
                    onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={8}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700">
                    Temperature: {promptForm.temperature}
                  </label>
                  <input
                    type="range"
                    id="temperature"
                    min="0"
                    max="1"
                    step="0.1"
                    value={promptForm.temperature}
                    onChange={(e) => setPromptForm({ ...promptForm, temperature: parseFloat(e.target.value) })}
                    className="mt-1 w-full"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
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
    </div>
  );
}
