import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';
import { PdfReprocessButton } from './PdfReprocessButton';

interface PdfContentProps {
  pdfs: {
    id: string;
    url: string;
    content?: string;
    feedItemId?: string;
    createdAt?: string;
  }[];
  showReprocessButton?: boolean;
}

/**
 * Component for displaying PDF content associated with a feed item
 */
export function PdfContent({ pdfs: initialPdfs, showReprocessButton = true }: PdfContentProps) {
  const [pdfs, setPdfs] = useState(initialPdfs);
  if (!pdfs || pdfs.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Attached PDFs ({pdfs.length})
      </h3>
      
      {pdfs.map((pdf) => (
        <Card key={pdf.id} className="overflow-hidden">
          <CardHeader className="bg-muted/50 pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">PDF Document</CardTitle>
              <div className="flex gap-2">
                {showReprocessButton && (
                  <PdfReprocessButton 
                    pdfId={pdf.id} 
                    size="sm" 
                    className="h-8"
                    onSuccess={(newContent) => {
                      // Update the PDF content in the UI
                      pdf.content = newContent;
                      // Force a re-render
                      setPdfs([...pdfs]);
                    }}
                  />
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => window.open(pdf.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open PDF
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs truncate">
              {pdf.url}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {pdf.content ? (
              <div className="max-h-96 overflow-y-auto text-sm">
                <p className="whitespace-pre-line">{pdf.content}</p>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>PDF content extraction not available</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
