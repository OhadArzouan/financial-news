// Type definitions for pdfjs-dist
declare module 'pdfjs-dist/legacy/build/pdf' {
  export * from 'pdfjs-dist';
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.entry' {
  const worker: any;
  export = worker;
}

// Override problematic types
declare module 'pdfjs-dist/types/src/display/annotation_storage' {
  export class AnnotationStorage {
    // Remove private fields that cause TypeScript errors
  }
}

// Add skipLibCheck: true to tsconfig.json to avoid checking node_modules
