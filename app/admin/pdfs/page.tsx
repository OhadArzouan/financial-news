'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PdfReprocessButton } from '../../../components/PdfReprocessButton';
import { Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface Pdf {
  id: string;
  url: string;
  content?: string;
  feedItemId: string;
  createdAt: string;
  feedItem?: {
    title: string;
    link: string;
  };
}

export default function AdminPdfsPage() {
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocessingAll, setReprocessingAll] = useState(false);
  const [reprocessedCount, setReprocessedCount] = useState(0);

  // Fetch PDFs that need reprocessing
  useEffect(() => {
    async function fetchPdfs() {
      try {
        setLoading(true);
        
        // For now, we'll use our script logic directly in the frontend
        // In a production app, you'd create proper API endpoints
        const response = await fetch('/api/admin/pdfs');
        if (!response.ok) {
          throw new Error('Failed to fetch PDFs');
        }
        
        const data = await response.json();
        setPdfs(data.pdfs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPdfs();
  }, []);

  // Function to reprocess all PDFs
  const handleReprocessAll = async () => {
    setReprocessingAll(true);
    setReprocessedCount(0);
    
    for (const pdf of pdfs) {
      try {
        const response = await fetch(`/api/pdfs/${pdf.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Update the PDF in the state
          setPdfs(prevPdfs => 
            prevPdfs.map(p => 
              p.id === pdf.id ? { ...p, content: data.content } : p
            )
          );
          
          setReprocessedCount(prev => prev + 1);
        }
      } catch (error) {
        console.error(`Error reprocessing PDF ${pdf.id}:`, error);
      }
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setReprocessingAll(false);
  };

  // Function to update a PDF in the state after reprocessing
  const handlePdfUpdated = (id: string, newContent: string) => {
    setPdfs(prevPdfs => 
      prevPdfs.map(pdf => 
        pdf.id === id ? { ...pdf, content: newContent } : pdf
      )
    );
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">PDF Management</h1>
        
        <div className="flex items-center gap-4">
          {reprocessingAll && (
            <div className="flex items-center text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Reprocessing {reprocessedCount}/{pdfs.length}
            </div>
          )}
          
          <Button 
            onClick={handleReprocessAll}
            disabled={loading || reprocessingAll || pdfs.length === 0}
          >
            Reprocess All PDFs
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <p>Loading PDFs...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          <p className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </p>
        </div>
      ) : pdfs.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700">
          <p className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            All PDFs have been successfully processed!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Found {pdfs.length} PDFs that need reprocessing
          </p>
          
          {pdfs.map((pdf) => (
            <Card key={pdf.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base">
                      {pdf.feedItem?.title || 'PDF Document'}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      {pdf.url}
                    </CardDescription>
                  </div>
                  
                  <PdfReprocessButton 
                    pdfId={pdf.id}
                    onSuccess={(newContent) => handlePdfUpdated(pdf.id, newContent)}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">
                    Content Length: {pdf.content?.length || 0} characters
                  </div>
                  {pdf.feedItem?.link && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(pdf.feedItem?.link, '_blank')}
                    >
                      View Article
                    </Button>
                  )}
                </div>
                
                {pdf.content ? (
                  <div className="max-h-32 overflow-y-auto text-sm border rounded-md p-2 bg-muted/20">
                    <p className="whitespace-pre-line">{pdf.content.substring(0, 300)}...</p>
                  </div>
                ) : (
                  <div className="py-4 text-center text-muted-foreground border rounded-md">
                    <FileText className="h-5 w-5 mx-auto mb-2 opacity-50" />
                    <p>No content extracted</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
