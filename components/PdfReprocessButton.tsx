'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

interface PdfReprocessButtonProps {
  pdfId: string;
  onSuccess?: (newContent: string) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

/**
 * Button component for triggering PDF reprocessing
 */
export function PdfReprocessButton({
  pdfId,
  onSuccess,
  variant = 'outline',
  size = 'sm',
  className = '',
}: PdfReprocessButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReprocess = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reprocess PDF');
      }

      const data = await response.json();
      
      if (onSuccess && data.content) {
        onSuccess(data.content);
      }
    } catch (error) {
      console.error('Error reprocessing PDF:', error);
      setError(error instanceof Error ? error.message : 'Failed to reprocess PDF');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleReprocess}
        variant={variant}
        size={size}
        className={className}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Reprocessing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reprocess PDF
          </>
        )}
      </Button>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </>
  );
}
