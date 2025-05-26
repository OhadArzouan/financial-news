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

type SortDirection = 'asc' | 'desc';
type SortField = 'datetime' | 'source';

type FeedItemWithSource = {
  item: FeedItem;
  feed: Feed;
};

export default function Home() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering and sorting state
  const [selectedFeed, setSelectedFeed] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('datetime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchFeeds();
  }, []);

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
    setRefreshing(true);
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
      setRefreshing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-md overflow-hidden rounded-lg border border-gray-100">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">RSS Feed Aggregator</h1>
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
                  disabled={refreshing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors duration-200 flex items-center gap-2 shadow-sm"
                >
                  {refreshing ? (
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
                <div className="flex items-center gap-2">
                  <label htmlFor="feed-filter" className="text-sm font-medium text-gray-700">
                    Feed Source:
                  </label>
                  <select
                    id="feed-filter"
                    value={selectedFeed}
                    onChange={(e) => setSelectedFeed(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="all">All Feeds</option>
                    {feeds.map((feed) => (
                      <option key={feed.id} value={feed.id.toString()}>
                        {feed.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="sort-field" className="text-sm font-medium text-gray-700">
                    Sort By:
                  </label>
                  <select
                    id="sort-field"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="datetime">Date & Time</option>
                    <option value="source">Feed Source</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {sortDirection === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
            </div>
            <form onSubmit={addFeed} className="mb-8 bg-white shadow-sm rounded-lg p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="feed-url" className="block text-sm font-medium text-gray-700 mb-2">
                    Add New Feed
                  </label>
                  <input
                    id="feed-url"
                    type="url"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    placeholder="Enter RSS feed URL"
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-200"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors duration-200 shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Adding...
                      </>
                    ) : (
                      'Add Feed'
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <div className="mt-4 p-4 bg-red-50 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </form>

            <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="divide-x divide-gray-200">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 w-1/6">
                      Feed Source
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 w-1/6">
                      Date & Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 w-1/6">
                      Item Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 w-1/4">
                      Description
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0 z-10 w-1/4">
                      Content
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feeds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No feeds available. Add your first RSS feed to get started!
                      </td>
                    </tr>
                  ) : (
                    feeds
                      .flatMap((feed) =>
                        feed.items.map((item) => {
                          if (selectedFeed !== 'all' && feed.id.toString() !== selectedFeed) {
                            return null;
                          }
                          return {item, feed};
                        })
                      )
                      .filter((item): item is FeedItemWithSource => item !== null)
                      .sort((a, b) => {
                        if (!a || !b) return 0;
                        
                        if (sortField === 'datetime') {
                          const dateA = new Date(a.item.publishedAt).getTime();
                          const dateB = new Date(b.item.publishedAt).getTime();
                          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
                        } else {
                          return sortDirection === 'asc' 
                            ? a.feed.title.localeCompare(b.feed.title)
                            : b.feed.title.localeCompare(a.feed.title);
                        }
                      })
                      .map(({item, feed}) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-normal">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{feed.title}</div>
                              {feed.description && (
                                <div className="text-sm text-gray-500">{feed.description}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-normal">
                            <time dateTime={item.publishedAt} className="text-sm text-gray-900">
                              {new Date(item.publishedAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
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
                              <div className="text-sm text-gray-900 prose max-w-none" 
                                   dangerouslySetInnerHTML={{ __html: item.content }} />
                            ) : null}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
