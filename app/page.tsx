'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PdfContent } from '../components/PdfContent';
import { PdfStats } from '../components/PdfStats';
import { PdfManagement } from '../components/PdfManagement';
import { format, subDays, parseISO } from 'date-fns';
import { RefreshCw, Plus, Trash2, FileText, ExternalLink, FileText as FileTextIcon, File as FileIcon } from 'lucide-react';

// Type Definitions
type TabType = 'summaries' | 'feeds' | 'pdfs' | 'prompts';
type SortDirection = 'asc' | 'desc';
type SortField = 'publishedAt' | 'feedTitle' | 'title';

// Interfaces
interface FeedItemPdf {
  id: string;
  url: string;
  content?: string;
  feedItemId: string;
  createdAt: string;
}

interface FeedItemBase {
  id: string;
  title: string;
  link: string;
  description: string;
  content: string;
  publishedAt: string;
  feedId: string;
  feedTitle?: string;
  feedUrl?: string;
  pdfs?: FeedItemPdf[];
  feed?: {
    title: string;
    url: string;
  };
  processedContent?: string;
  extendedContent?: string;
  author?: string;
  category?: string;
  createdAt?: string;
}

interface FeedItem extends FeedItemBase {
  feedTitle: string;
  feedUrl: string;
}

interface FeedItemWithFeed extends Omit<FeedItemBase, 'feedId'> {
  feedTitle: string;
  feedUrl: string;
  feedId: string;
}

interface Feed {
  id: string;
  title: string;
  url: string;
  lastFetched: string | null;
  last_fetched?: string;
  description: string | null;
  author: string | null;
  feedItems: FeedItem[];
  items: FeedItem[]; // Alias for feedItems
}

interface Summary {
  id: string;
  content: string;
  createdAt: string;
  systemPromptId: string;
  startDate: string;
  endDate: string;
  systemPrompt?: SystemPrompt;
  isDeleted?: boolean;
}

interface SystemPrompt {
  id: string;
  name: string;
  prompt: string;
  temperature: number;
  createdAt: string;
  updatedAt: string;
  created_at?: string; // For backward compatibility
}

interface PromptForm {
  name: string;
  prompt: string;
  temperature: number;
}

export default function Home() {
  // Component State
  const [isMounted, setIsMounted] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('feeds');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Modal States
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [showPdfManager, setShowPdfManager] = useState(false);
  const [showCreateSummary, setShowCreateSummary] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  
  // Data States
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [allItems, setAllItems] = useState<FeedItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FeedItem[]>([]);
  
  // Filtering & Sorting State
  const [feedFilter, setFeedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('publishedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Form State
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newPrompt, setNewPrompt] = useState<PromptForm>({
    name: '',
    prompt: '',
    temperature: 0.7
  });
  
  const [summaryForm, setSummaryForm] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    systemPromptId: '',
    overwrite: false
  });
  
  // Loading & Status States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingSummary, setIsCreatingSummary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeletingSummary, setIsDeletingSummary] = useState(false);
  
  // Error States
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  
  // Selection States
  const [selectedPdf, setSelectedPdf] = useState<FeedItemPdf | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  
  // Processing States
  const [refreshingFeedIds, setRefreshingFeedIds] = useState<Set<string>>(new Set());
  const [extractingPdfFeedIds, setExtractingPdfFeedIds] = useState<Set<string>>(new Set());
  
  // Derived State
  const feedItems = useMemo(() => {
    return feeds.flatMap(feed => feed.feedItems || []);
  }, [feeds]);
  
  const filteredFeedItems = useMemo(() => {
    if (feedFilter === 'all') return feedItems;
    return feedItems.filter(item => item.feedId === feedFilter);
  }, [feedItems, feedFilter]);
  
  // Component Mount Effect
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch feeds
        const feedsResponse = await fetch('/api/feeds');
        const feedsData = await feedsResponse.json();
        
        // Ensure feedsData is an array before mapping
        const feedsArray = Array.isArray(feedsData) ? feedsData : [];
        
        // Transform the data to match our interface
        const transformedFeeds = feedsArray.map((feed: any) => ({
          ...feed,
          lastFetched: feed.lastFetched || feed.last_fetched || null,
          items: feed.items || [],
          feedItems: feed.items || []
        }));
        
        setFeeds(transformedFeeds);
        
        // Fetch summaries
        const summariesResponse = await fetch('/api/summaries');
        const summariesData = await summariesResponse.json();
        setSummaries(summariesData);
        
        // Fetch system prompts
        const promptsResponse = await fetch('/api/system-prompts');
        const promptsData = await promptsResponse.json();
        setSystemPrompts(promptsData);
        
        // Flatten all feed items for the unified view
        const allFeedItems: FeedItem[] = [];
        
        transformedFeeds.forEach((feed: Feed) => {
          if (!feed.items) return;
          
          feed.items.forEach((item: FeedItem) => {
            allFeedItems.push({
              ...item,
              feedTitle: feed.title,
              feedUrl: feed.url,
              feedId: feed.id.toString(),
              id: item.id.toString(),
              title: item.title || 'Untitled',
              link: item.link || '#',
              description: item.description || '',
              content: item.content || '',
              publishedAt: item.publishedAt || new Date().toISOString(),
              processedContent: item.processedContent,
              extendedContent: item.extendedContent,
              pdfs: item.pdfs || [],
              author: item.author,
              category: item.category,
              createdAt: item.createdAt || new Date().toISOString(),
              feed: {
                title: feed.title,
                url: feed.url
              }
            });
          });
        });
        
        setAllItems(allFeedItems);
        setFilteredItems(allFeedItems);
        
      } catch (err) {
        setError('Failed to fetch data. Please try again later.');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle summary form input changes
  const handleSummaryFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (name === 'start' || name === 'end') {
      setDateRange(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      setSummaryForm(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) : value
      }));
    }
  };

  // Handle prompt form input changes
  const handlePromptFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewPrompt(prev => ({
      ...prev,
      [name]: name === 'temperature' ? parseFloat(value) : value
    }));
  };
  
  // Set up prompt form when editing
  const handleEditPrompt = (prompt: SystemPrompt) => {
    setNewPrompt({
      name: prompt.name,
      prompt: prompt.prompt,
      temperature: prompt.temperature
    });
    setEditingPrompt(prompt);
    setShowPromptModal(true);
  };

  useEffect(() => {
    if (editingPrompt) {
      setNewPrompt({
        name: editingPrompt.name,
        prompt: editingPrompt.prompt,
        temperature: editingPrompt.temperature
      });
    } else {
      setNewPrompt({
        name: '',
        prompt: '',
        temperature: 0.7
      });
    }
  }, [editingPrompt]);

  // Create a new summary
  const handleCreateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted');
    
    try {
      if (!summaryForm.systemPromptId) {
        throw new Error('Please select a system prompt');
      }

      const startDate = new Date(summaryForm.startDate);
      const endDate = new Date(summaryForm.endDate);
      
      // Basic validation
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Please select valid dates');
      }

      if (startDate > endDate) {
        throw new Error('End date must be after start date');
      }

      console.log('Starting summary creation with:', { startDate, endDate, systemPromptId: summaryForm.systemPromptId });
      
      setIsCreatingSummary(true);
      setError(null);
      
      // First, generate the summary content
      console.log('Calling generate-summary API');
      const generateResponse = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          systemPromptId: summaryForm.systemPromptId,
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const { content } = await generateResponse.json();
      console.log('Received generated content, now saving summary');

      // Then save the generated summary
      const response = await fetch('/api/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          systemPromptId: summaryForm.systemPromptId,
          overwrite: summaryForm.overwrite,
          content, // Use the generated content
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create summary');
      }

      const newSummary = await response.json();
      setSummaries(prev => [newSummary.summary, ...prev]);
      setShowCreateSummary(false);
      setSummaryForm({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        systemPromptId: systemPrompts[0]?.id || '',
        overwrite: false
      });
    } catch (err) {
      console.error('Error in summary creation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create summary');
    } finally {
      setIsCreatingSummary(false);
    }
  };

  // Apply filtering whenever feeds or filter changes
  useEffect(() => {
    if (feeds.length > 0) {
      // Create the flattened list of items with feed info
      const allItems: FeedItemWithFeed[] = [];
      
      feeds.forEach(feed => {
        if (!feed.items) return;
        
        feed.items.forEach(item => {
          allItems.push({
            ...item,
            feedTitle: feed.title,
            feedUrl: feed.url || '',
            feedId: String(feed.id),
            id: String(item.id),
            title: item.title || 'Untitled',
            link: item.link || '#',
            description: item.description || '',
            publishedAt: item.publishedAt || new Date().toISOString(),
            processedContent: item.processedContent,
            extendedContent: item.extendedContent,
            pdfs: item.pdfs || [],
            author: item.author,
            category: item.category,
            createdAt: (item as any).createdAt || new Date().toISOString()
          });
        });
      });
      
      // Apply filtering based on selected feed
      if (feedFilter && feedFilter !== 'all') {
        const filtered = allItems.filter(item => item.feedId === feedFilter);
        setFilteredItems(filtered);
      } else {
        setFilteredItems(allItems);
      }
    }
  }, [feeds, feedFilter]);

  const fetchFeeds = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/feeds');
      if (!response.ok) throw new Error('Failed to fetch feeds');
      const data = await response.json();
      setFeeds(data);
    } catch (err) {
      console.error('Error fetching feeds:', err);
      setError('Failed to fetch feeds');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummaries = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/summaries?t=${timestamp}`);
      const responseText = await response.text();
      console.log('Raw API response:', responseText);
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse JSON:', jsonError);
        setError('Invalid JSON response from API');
        return;
      }
      if (!response.ok) {
        console.error('API error status:', response.status);
        setError(`API error: ${response.status}`);
        return;
      }
      if (Array.isArray(data)) {
        setSummaries(data);
      } else if (data && Array.isArray(data.summaries)) {
        setSummaries(data.summaries);
      } else {
        console.error('Unexpected response format:', data);
        setError('Invalid data format from API');
      }
    } catch (err) {
      console.error('Error fetching summaries:', err);
      setError(err instanceof Error ? err.message : 'Network or server error');
    } finally {
      setIsLoading(false);
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
    
    setIsLoading(true);
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
      
      setNewFeedUrl('');
      setShowAddFeed(false);
      await fetchFeeds();
    } catch (err) {
      console.error('Error adding feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to add feed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPrompt.name || !newPrompt.prompt) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const url = editingPrompt 
        ? `/api/system-prompts/${editingPrompt.id}`
        : '/api/system-prompts';
      const method = editingPrompt ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrompt),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save prompt');
      }
      
      setNewPrompt({
        name: '',
        prompt: '',
        temperature: 0.7
      });
      setShowPromptModal(false);
      setEditingPrompt(null);
      await fetchSystemPrompts();
    } catch (err) {
      console.error('Error saving prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setIsLoading(false);
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

  const handleRefreshFeed = async (feedId: string) => {
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
      
      await fetchFeeds();
      
    } catch (err) {
      console.error(`Error refreshing feed ${feedId}:`, err);
      setError(`Failed to refresh feed: ${(err as Error).message}`);
    } finally {
      setRefreshingFeedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
    }
  };

  const handleExtractPdfs = async (feedId: string) => {
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
      
      alert(`PDF extraction completed: ${result.stats.pdfsExtracted} PDFs extracted`);
      
      await fetchFeeds();
      
    } catch (err) {
      console.error(`Error extracting PDFs from feed ${feedId}:`, err);
      setError(`Failed to extract PDFs: ${(err as Error).message}`);
    } finally {
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
    setIsLoading(true);
    try {
      const url = editingPrompt 
        ? `/api/system-prompts/${editingPrompt.id}`
        : '/api/system-prompts';
        
      const method = editingPrompt ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrompt),
      });
      if (!response.ok) {
        throw new Error('Failed to save prompt');
      }
      await fetchSystemPrompts();
      setShowPromptModal(false);
      setNewPrompt({ name: '', prompt: '', temperature: 0.7 });
      setEditingPrompt(null);
    } catch (err) {
      console.error('Error saving prompt:', err);
      setError('Failed to save prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedPromptId || !dateRange.start || !dateRange.end) return;
    
    setIsLoading(true);
    setIsGenerating(true);
    setRegeneratingId(null); 
    setSummaryError(null);
    
    try {
      const existingSummaries = summaries.filter(summary => {
        const summaryStartDate = new Date(summary.startDate).toISOString().split('T')[0];
        const summaryEndDate = new Date(summary.endDate).toISOString().split('T')[0];
        return (
          summaryStartDate === dateRange.start && 
          summaryEndDate === dateRange.end && 
          summary.systemPromptId === selectedPromptId
        );
      });
      
      if (existingSummaries.length > 0) {
        setSummaryError('A summary already exists for this date range and prompt. Please use the regenerate option instead.');
        setIsGenerating(false);
        return;
      }
      
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
          systemPromptId: selectedPromptId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      
      const data = await response.json();
      
      const requestBody = {
        startDate: dateRange.start,
        endDate: dateRange.end,
        content: data.content,
        systemPromptId: selectedPromptId,
        overwrite: true 
      };
      
      console.log('Saving summary with data:', requestBody);
      
      const createResponse = await fetch('/api/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const responseData = await createResponse.json().catch(() => ({}));
      
      if (!createResponse.ok) {
        console.error('Error response from summaries API:', responseData, 'Status:', createResponse.status);
        throw new Error(`Failed to save summary: ${createResponse.status} ${responseData.error || ''}`);
      }
      
      console.log(responseData?.message);
      
      await fetchSummaries();
      
      setDateRange({ start: '', end: '' });
      
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      setRegeneratingId(null);
    }
  };
  
  const handleRegenerateSummary = async (summary: Summary) => {
    if (isGenerating) return;
    
    setIsLoading(true);
    setIsGenerating(true);
    setRegeneratingId(summary.id);
    setSummaryError(null);
    
    try {
      const startDate = new Date(summary.startDate);
      const endDate = new Date(summary.endDate);
      const promptId = summary.systemPromptId;
      
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          systemPromptId: promptId
        }),
      });
      
      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error('Error response from generate-summary:', responseData, 'Status:', response.status);
        throw new Error(`Failed to regenerate summary: ${response.status} ${responseData.error || ''}`);
      }
      
      const updateResponse = await fetch(`/api/summaries/${summary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: responseData.content
        }),
      });
      
      const updateData = await updateResponse.json().catch(() => ({}));
      
      if (!updateResponse.ok) {
        console.error('Error updating summary:', updateData, 'Status:', updateResponse.status);
        throw new Error(`Failed to update summary: ${updateResponse.status} ${updateData.error || ''}`);
      }
      
      await fetchSummaries();
      
    } catch (error: any) {
      console.error('Error regenerating summary:', error);
      setSummaryError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      setRegeneratingId(null);
    }
  };
  
  const handleDeleteSummary = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this summary? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/summaries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete summary');
      }

      await fetchSummaries();
    } catch (err) {
      console.error('Error deleting summary:', err);
      setError('Failed to delete summary');
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/system-prompts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Received invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete prompt');
      }
      
      // Refresh the prompts list
      await fetchSystemPrompts();
    } catch (err) {
      console.error('Error deleting prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete prompt');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title heading removed */}
        
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
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Summaries</h2>
                  <button
                    onClick={() => setShowCreateSummary(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                  >
                    Create Summary
                  </button>
                </div>

                {/* Create Summary Form */}
                {showCreateSummary && (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-medium mb-4">Create New Summary</h3>
                    <form onSubmit={handleCreateSummary} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            id="startDate"
                            name="startDate"
                            value={summaryForm.startDate}
                            onChange={handleSummaryFormChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            max={summaryForm.endDate}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            id="endDate"
                            name="endDate"
                            value={summaryForm.endDate}
                            onChange={handleSummaryFormChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min={summaryForm.startDate}
                            max={new Date().toISOString().split('T')[0]}
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="systemPromptId" className="block text-sm font-medium text-gray-700 mb-1">
                          System Prompt
                        </label>
                        <select
                          id="systemPromptId"
                          name="systemPromptId"
                          value={summaryForm.systemPromptId}
                          onChange={handleSummaryFormChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {systemPrompts.map((prompt) => (
                            <option key={prompt.id} value={prompt.id}>
                              {prompt.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="overwrite"
                          name="overwrite"
                          checked={summaryForm.overwrite}
                          onChange={handleSummaryFormChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="overwrite" className="ml-2 block text-sm text-gray-700">
                          Overwrite existing summary for this period
                        </label>
                      </div>

                      <div className="flex justify-end space-x-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateSummary(false)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                          disabled={isCreatingSummary}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                          disabled={isCreatingSummary}
                        >
                          {isCreatingSummary ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Creating...
                            </>
                          ) : 'Create Summary'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Summaries List */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                  {summaries.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {summaries.map((summary) => {
                        const startDate = new Date(summary.startDate);
                        const endDate = new Date(summary.endDate);
                        const systemPrompt = systemPrompts.find(p => p.id === summary.systemPromptId);
                        
                        return (
                          <div key={summary.id} className="p-6 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">
                                  {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                                </h3>
                                {systemPrompt && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    Using prompt: <span className="font-medium">{systemPrompt.name}</span>
                                  </p>
                                )}
                                <div className="mt-4 p-4 bg-gray-50 rounded-md max-h-60 overflow-y-auto">
                                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: summary.content || 'No content available' }} />
                                </div>
                              </div>
                              <div className="flex items-center">
                                <button
                                  onClick={() => handleDeleteSummary(summary.id)}
                                  className="text-red-600 hover:text-white hover:bg-red-600 p-4 rounded-full transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-opacity-50"
                                  title="Delete summary"
                                  aria-label="Delete summary"
                                  style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                                >
                                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Created on {new Date(summary.createdAt).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No summaries</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Get started by creating a new summary.
                      </p>
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => setShowCreateSummary(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          New Summary
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                        disabled={!newFeedUrl || isLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors duration-200"
                      >
                        {isLoading ? (
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
                              {feed.lastFetched ? new Date(feed.lastFetched).toLocaleString() : 'Never'}
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
