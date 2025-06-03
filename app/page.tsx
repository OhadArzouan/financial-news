'use client';

import React, { useState, useEffect } from 'react';

type TabType = 'feeds' | 'summaries' | 'prompts';

interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  published: string;
  author?: string;
  category?: string;
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

                <div className="mt-6">
                  {feeds.map((feed) => (
                    <div key={feed.id} className="mb-8 bg-white shadow-sm rounded-lg border border-gray-200">
                      <div className="p-6">
                        <h3 className="text-lg font-medium text-gray-900">{feed.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">{feed.url}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          Last fetched: {new Date(feed.last_fetched).toLocaleString()}
                        </p>
                      </div>
                      <div className="border-t border-gray-200">
                        <div className="p-6">
                          <h4 className="text-sm font-medium text-gray-900 mb-4">Recent Items</h4>
                          <div className="space-y-4">
                            {feed.items.map((item) => (
                              <div key={item.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {item.title}
                                </a>
                                <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                                <div className="mt-2 text-xs text-gray-400 flex gap-4">
                                  <span>Published: {new Date(item.published).toLocaleString()}</span>
                                  {item.author && <span>Author: {item.author}</span>}
                                  {item.category && <span>Category: {item.category}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
