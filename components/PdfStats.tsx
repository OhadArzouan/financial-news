'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PdfStats {
  totalPdfs: number;
  processedPdfs: number;
  problemPdfs: number;
  emptyPdfs: number;
  shortPdfs: number;
}

export function PdfStats() {
  const [stats, setStats] = useState<PdfStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/pdfs');
        
        if (!response.ok) {
          throw new Error('Failed to fetch PDF statistics');
        }
        
        const data = await response.json();
        
        // Calculate stats from the API response
        const totalPdfs = await fetchTotalPdfsCount();
        const problemPdfs = data.totalCount || 0;
        const processedPdfs = totalPdfs - problemPdfs;
        
        setStats({
          totalPdfs,
          processedPdfs,
          problemPdfs,
          emptyPdfs: data.emptyCount || 0,
          shortPdfs: data.shortCount || 0
        });
      } catch (err) {
        console.error('Error fetching PDF stats:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    // Helper function to get total PDFs count
    async function fetchTotalPdfsCount() {
      try {
        const response = await fetch('/api/admin/pdfs/count');
        if (!response.ok) {
          return 0;
        }
        const data = await response.json();
        return data.count || 0;
      } catch (error) {
        console.error('Error fetching total PDFs count:', error);
        return 0;
      }
    }
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            PDF Processing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>Loading statistics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            PDF Processing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-500 py-2">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const successRate = stats.totalPdfs > 0 
    ? Math.round((stats.processedPdfs / stats.totalPdfs) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          PDF Processing Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total PDFs:</span>
            <span className="font-medium">{stats.totalPdfs}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Successfully Processed:</span>
            <span className="font-medium flex items-center">
              {stats.processedPdfs}
              <CheckCircle className="h-4 w-4 ml-1 text-green-500" />
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Need Attention:</span>
            <span className="font-medium flex items-center">
              {stats.problemPdfs}
              {stats.problemPdfs > 0 && (
                <AlertCircle className="h-4 w-4 ml-1 text-amber-500" />
              )}
            </span>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${
                successRate > 90 ? 'bg-green-500' : 
                successRate > 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${successRate}%` }}
            ></div>
          </div>
          
          <div className="text-xs text-center text-muted-foreground">
            {successRate}% successfully processed
          </div>
          
          {stats.problemPdfs > 0 && (
            <Link 
              href="/admin/pdfs" 
              className="block w-full text-center text-sm text-blue-600 hover:underline mt-2"
            >
              View PDFs needing attention
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
