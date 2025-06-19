/**
 * Script to test the PDF update API endpoint
 */
const fetch = require('node-fetch');

// The specific PDF ID to update
const PDF_ID = 104;

// The API endpoint URL (assuming the dev server is running on port 3000)
const API_URL = `http://localhost:3000/api/pdfs/${PDF_ID}/update`;

async function testUpdatePdfApi() {
  try {
    console.log(`Testing PDF update API for PDF ID: ${PDF_ID}`);
    console.log(`API URL: ${API_URL}`);
    
    // Call the API endpoint
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Parse the response
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`API error (${response.status}):`, result);
      return;
    }
    
    console.log('API response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

// Run the test
testUpdatePdfApi();
