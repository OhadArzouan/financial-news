interface FeedItem {
  title: string;
  url: string;
  description: string | null;
  content: string | null;
  processedContent: string | null;
  publishedAt: string;
  author: string | null;
  category: string | null;
}

export function generateCsv(items: Array<{ item: FeedItem; feed: { title: string } }>) {
  // Define CSV headers
  const headers = [
    'Feed',
    'Title',
    'URL',
    'Published Date',
    'Author',
    'Category',
    'Description',
    'Content'
  ];

  // Convert items to CSV rows
  const rows = items.map(({ item, feed }) => [
    feed.title,
    item.title,
    item.url,
    new Date(item.publishedAt).toISOString(),
    item.author || '',
    item.category || '',
    item.description || '',
    item.processedContent || item.content || ''
  ].map(field => 
    // Escape fields that contain commas, quotes, or newlines
    typeof field === 'string' && /[",\n]/.test(field)
      ? `"${field.replace(/"/g, '""')}"`
      : field
  ));

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  // Create download link
  if ('msSaveBlob' in navigator) { // IE 10+
    (navigator as any).msSaveBlob(blob, filename);
  } else {
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
