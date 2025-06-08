'use client';

import React, { useState, useEffect } from 'react';
import { PdfContent } from '../components/PdfContent';
import { PdfStats } from '../components/PdfStats';
import { PdfManagement } from '../components/PdfManagement';

type TabType = 'summaries' | 'feeds' | 'pdfs' | 'prompts'; // Available tab types

interface FeedItemPdf {
  id: string;
  url: string;
  content?: string;
  feedItemId: string;
  createdAt: string;
}

interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  processedContent?: string;
  extendedContent?: string; // Content fetched from the linked URL
  pdfs?: FeedItemPdf[];     // Array of PDFs attached to this feed item
  author?: string;
  category?: string;
  feedId: string; // This is the ID of the feed this item belongs to
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
  startDate: string;
  endDate: string;
  isDeleted?: boolean;
  content: string;
  createdAt: string;
  systemPromptId: string;
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
  const [refreshingFeedIds, setRefreshingFeedIds] = useState<Set<string>>(new Set());
  const [extractingPdfFeedIds, setExtractingPdfFeedIds] = useState<Set<string>>(new Set());
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
  const [filteredItems, setFilteredItems] = useState<(FeedItem & { feedTitle: string })[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [dateRange, setDateRange] = useState<{startDate: string, endDate: string}>({startDate: '', endDate: ''});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isDeletingSummary, setIsDeletingSummary] = useState<boolean>(false);
  const [showAddFeed, setShowAddFeed] = useState<boolean>(false);

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
  
  // Apply filtering whenever feeds or filter changes
  useEffect(() => {
    if (feeds.length > 0) {
      // Create the flattened list of items with feed info
      const allItems = feeds.flatMap(feed => 
        feed.items.map(item => ({
          ...item,
          feedTitle: feed.title,
          // Make sure we have a consistent string for comparison
          feedId: String(feed.id)
        }))
      );
      
      // Apply filtering based on selected feed
      if (feedFilter === 'all') {
        setFilteredItems(allItems);
      } else {
        const filtered = allItems.filter(item => item.feedId === feedFilter);
        setFilteredItems(filtered);
      }
    }
  }, [feeds, feedFilter]);

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
      // Add a timestamp to bust cache
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/summaries?t=${timestamp}`);
      
      // Try to get response text first for debugging
      const responseText = await response.text();
      console.log('Raw API response:', responseText);
      
      // Parse the JSON manually to avoid JSON parsing errors
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse JSON:', jsonError);
        setError('Invalid JSON response from API');
        return;
      }
      
      // Check response status
      if (!response.ok) {
        console.error('API error status:', response.status);
        setError(`API error: ${response.status}`);
        return;
      }
      
      // Handle the response data
      if (Array.isArray(data)) {
        // Direct array of summaries
        setSummaries(data);
      } else if (data && Array.isArray(data.summaries)) {
        // Wrapped in summaries object
        setSummaries(data.summaries);
      } else {
        console.error('Unexpected response format:', data);
        setError('Invalid data format from API');
      }
    } catch (err) {
      console.error('Error fetching summaries:', err);
      setError(err instanceof Error ? err.message : 'Network or server error');
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

  const handleAddFeed = async (e: React.MouseEvent<HTMLButtonElement> | React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newFeedUrl }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add feed');
      }
      
      // Reset form and refresh feeds
      setNewFeedUrl('');
      setShowAddFeed(false);
      await fetchFeeds();
    } catch (err) {
      console.error('Error adding feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshFeeds = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/feeds/refresh', {
        method: 'POST',
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

  const handleHardRefreshFeeds = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullRefresh: true }),
      });
      if (!response.ok) {
        throw new Error('Failed to hard refresh feeds');
      }
      await fetchFeeds();
    } catch (err) {
      console.error('Error hard refreshing feeds:', err);
      setError('Failed to hard refresh feeds');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to refresh a single feed with enhanced content and PDF extraction
  const handleRefreshFeed = async (feedId: string) => {
    // Add feedId to the set of refreshing feeds
    setRefreshingFeedIds(prev => new Set([...prev, feedId]));
    setError(null);
    
    try {
      console.log(`Refreshing feed with ID: ${feedId}`);
      const response = await fetch(`/api/feeds/${feedId}/refresh`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to refresh feed: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Feed refresh result:', result);
      
      // Fetch updated feeds
      await fetchFeeds();
      
    } catch (err) {
      console.error(`Error refreshing feed ${feedId}:`, err);
      setError(`Failed to refresh feed: ${(err as Error).message}`);
    } finally {
      // Remove feedId from the set of refreshing feeds
      setRefreshingFeedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
    }
  };

  // Function to extract PDFs from existing feed items
  const handleExtractPdfs = async (feedId: string) => {
    // Add feedId to the set of extracting PDF feeds
    setExtractingPdfFeedIds(prev => new Set([...prev, feedId]));
    setError(null);
    
    try {
      console.log(`Extracting PDFs from feed with ID: ${feedId}`);
      const response = await fetch(`/api/feeds/${feedId}/extract-pdfs`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to extract PDFs: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      console.log('PDF extraction result:', result);
      
      // Show a success message
      alert(`PDF extraction completed: ${result.stats.pdfsExtracted} PDFs extracted`);
      
      // Fetch updated feeds
      await fetchFeeds();
      
    } catch (err) {
      console.error(`Error extracting PDFs from feed ${feedId}:`, err);
      setError(`Failed to extract PDFs: ${(err as Error).message}`);
    } finally {
      // Remove feedId from the set of extracting PDF feeds
      setExtractingPdfFeedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
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

  const handleGenerateSummary = async () => {
    if (!selectedPromptId || !dateRange.startDate || !dateRange.endDate) return;
    
    setIsGenerating(true);
    setRegeneratingId(null); // Ensure regeneratingId is cleared
    setSummaryError(null);
    
    try {
      // First check if a summary for this prompt and date range already exists
      const existingSummaries = summaries.filter(summary => {
        const summaryStartDate = new Date(summary.startDate).toISOString().split('T')[0];
        const summaryEndDate = new Date(summary.endDate).toISOString().split('T')[0];
        return (
          summaryStartDate === dateRange.startDate && 
          summaryEndDate === dateRange.endDate && 
          summary.systemPromptId === selectedPromptId
        );
      });
      
      if (existingSummaries.length > 0) {
        setSummaryError('A summary already exists for this date range and prompt. Please use the regenerate option instead.');
        setIsGenerating(false);
        return;
      }
      
      // Call the generate-summary API
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          systemPromptId: selectedPromptId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      
      const data = await response.json();
      
      // Create a new summary in the database
      const requestBody = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        content: data.content,
        systemPromptId: selectedPromptId,
        overwrite: true // Always overwrite if a duplicate exists
      };
      
      console.log('Saving summary with data:', requestBody);
      
      const createResponse = await fetch('/api/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      // Read the response body only once
      const responseData = await createResponse.json().catch(() => ({}));
      
      if (!createResponse.ok) {
        console.error('Error response from summaries API:', responseData, 'Status:', createResponse.status);
        throw new Error(`Failed to save summary: ${createResponse.status} ${responseData.error || ''}`);
      }
      
      // Log any messages from the API
      if (responseData?.message) {
        console.log(responseData.message);
      }
      
      // Refresh the summaries list
      await fetchSummaries();
      
      // Reset form
      setDateRange({startDate: '', endDate: ''});
      
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsGenerating(false);
      setRegeneratingId(null);
    }
  };
  
  const handleRegenerateSummary = async (summary: Summary) => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setRegeneratingId(summary.id);
    setSummaryError(null);
    
    try {
      // Use the existing summary's date range and prompt ID
      const startDate = new Date(summary.startDate);
      const endDate = new Date(summary.endDate);
      const promptId = summary.systemPromptId;
      
      // Call the generate-summary API
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          systemPromptId: promptId
        }),
      });
      
      // Read response data
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error('Error response from generate-summary:', responseData, 'Status:', response.status);
        throw new Error(`Failed to regenerate summary: ${response.status} ${responseData.error || ''}`);
      }
      
      // Update the existing summary
      const updateResponse = await fetch(`/api/summaries/${summary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: responseData.content
        }),
      });
      
      // Parse the response
      const updateData = await updateResponse.json().catch(() => ({}));
      
      if (!updateResponse.ok) {
        console.error('Error updating summary:', updateData, 'Status:', updateResponse.status);
        throw new Error(`Failed to update summary: ${updateResponse.status} ${updateData.error || ''}`);
      }
      
      // Refresh the summaries list
      await fetchSummaries();
      
    } catch (error: any) {
      console.error('Error regenerating summary:', error);
      setSummaryError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
      setRegeneratingId(null);
    }
  };
  
  const handleDeleteSummary = async (id: string) => {
    if (!confirm('Are you sure you want to delete this summary?')) return;
    
    setIsDeletingSummary(true);
    try {
      const response = await fetch(`/api/summaries/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }
      
      // Refresh the summaries list
      await fetchSummaries();
    } catch (error) {
      console.error('Error deleting summary:', error);
    } finally {
      setIsDeletingSummary(false);
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
        {/* Title heading removed */}
        
        {/* PDF Statistics Dashboard */}
        <div className="mb-8">
          <PdfStats />
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="bg-white shadow-sm rounded-lg">
          {/* Tab navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {(['summaries', 'feeds', 'pdfs', 'prompts'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'summaries' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Summaries</h2>
                {/* Summaries content */}
              </div>
            )}

            {activeTab === 'feeds' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Feeds</h2>
                  <button
                    onClick={() => setShowAddFeed(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                  >
                    Add Feed
                  </button>
                </div>

                {/* Add Feed Form */}
                {showAddFeed && (
                  <form onSubmit={handleAddFeed} className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h3 className="text-lg font-medium mb-3">Add New Feed</h3>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={newFeedUrl}
                        onChange={(e) => setNewFeedUrl(e.target.value)}
                        placeholder="Enter feed URL"
                        required
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={!newFeedUrl || loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors duration-200"
                      >
                        {loading ? (
                          <span className="inline-flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adding...
                          </span>
                        ) : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddFeed(false);
                          setError(null);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                  </form>
                )}

                {/* Feed List */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            URL
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Fetched
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {feeds.map((feed) => (
                          <tr key={feed.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {feed.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <a
                                href={feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                {feed.url}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(feed.last_fetched).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleRefreshFeed(feed.id);
                                  }}
                                  disabled={refreshingFeedIds.has(feed.id)}
                                  className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                  title="Refresh this feed"
                                >
                                  {refreshingFeedIds.has(feed.id) ? (
                                    <span className="inline-flex items-center">
                                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Refreshing...
                                    </span>
                                  ) : 'Refresh'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleExtractPdfs(feed.id);
                                  }}
                                  disabled={extractingPdfFeedIds.has(feed.id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 ml-2"
                                  title="Extract PDFs from this feed"
                                >
                                  {extractingPdfFeedIds.has(feed.id) ? (
                                    <span className="inline-flex items-center">
                                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Extracting...
                                    </span>
                                  ) : 'Extract PDFs'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Feed Items */}
                <div className="mt-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-medium">Feed Items</h3>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-full sm:w-64">
                        <label htmlFor="feed-filter" className="block text-sm font-medium text-gray-700 mb-1">Filter by feed</label>
                        <select
                          id="feed-filter"
                          value={feedFilter}
                          onChange={(e) => setFeedFilter(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">All Feeds</option>
                          {feeds.map((feed) => (
                            <option key={feed.id} value={feed.id}>
                              {feed.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full sm:w-auto">
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-medium text-gray-700">Sort by:</label>
                          <select
                            value={sortField}
                            onChange={(e) => setSortField(e.target.value as SortField)}
                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="publishedAt">Date</option>
                            <option value="feedTitle">Feed</option>
                          </select>
                          <button
                            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
                            title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
                          >
                            {sortDirection === 'asc' ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="w-2/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Title & Content
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Feed
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredItems.length > 0 ? (
                            filteredItems.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="w-2/6 px-6 py-4">
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-medium block mb-1"
                                  >
                                    {item.title}
                                  </a>
                                  <div className="text-sm text-gray-500 max-h-[200px] overflow-y-auto bg-gray-50 p-3 rounded">
                                    {item.processedContent || item.description || 'No content available'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {item.feedTitle}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <time dateTime={item.publishedAt}>
                                    {new Date(item.publishedAt).toLocaleString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </time>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-sm">No feed items found. Try refreshing your feeds.</p>
                                  <button
                                    onClick={handleRefreshFeeds}
                                    disabled={isRefreshing}
                                    className="mt-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-1"
                                  >
                                    {isRefreshing ? (
                                      <>
                                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Refreshing...
                                      </>
                                    ) : 'Refresh Feeds'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pdfs' && (
              <PdfManagement />
            )}

            {activeTab === 'prompts' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">System Prompts</h2>
                {/* Prompts content */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
