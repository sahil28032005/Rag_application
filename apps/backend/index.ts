import { serve } from "bun";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync, stat } from "node:fs";
import { Queue } from "bullmq";
import { createClient } from "redis";
import { url } from "node:inspector";
import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Access environment variables
const PORT = parseInt(process.env.PORT || "3001");
const NODE_ENV = process.env.NODE_ENV || "development";

// Redis connection settings
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

// Gemini AI configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
console.log("API Key loaded:", GOOGLE_API_KEY ? "Yes (length: " + GOOGLE_API_KEY.length + ")" : "No");
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || "");

// Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333"
});

// Text extractor configuration
const TEXT_EXTRACTOR_URL = process.env.TEXT_EXTRACTOR_URL || 'http://localhost:5000';

//initialize queue
// Queue configuration
const pdfQueue = new Queue('pdf-processing', {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  }
});


//DEFINING SERVER SIDE FILE DEST
const UPLOAD_DIR = join(process.cwd(), "uploads");

//ennsure directory exists
if (!existsSync(UPLOAD_DIR)) {
  await mkdir(UPLOAD_DIR, { recursive: true });
}
//initialize server
const server = serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Basic routing
    if (url.pathname === "/") {
      return new Response("Welcome to the Bun API server!");
    }

    if (url.pathname === "/api/hello") {
      return Response.json({
        message: "Hello from Bun!",
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
      });
    }

    //create pdf upload endpoint
    if (url.pathname === "/api/upload") {
      return handleUpload(req);
    }

    // Search endpoint
    if (url.pathname === "/api/search") {
      return handleSearch(req);
    }

    // Handle 404
    return new Response("Not Found", { status: 404 });
  },
});

//handle pdf upload
async function handleUpload(req: Request) {
  try {
    // Check if the content type is multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    console.log("content type",contentType);
    if (!contentType.includes('multipart/form-data')) {
      return new Response("Invalid request format. Use multipart/form-data.", { status: 400 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return new Response("No valid file provided", { status: 400 });
    }

    // Now fileEntry is known to be a File
    const file = fileEntry;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    //validate fule type
    if (!file.type || file.type !== "application/pdf") {
      return new Response("Invalid file type. Only PDF files are allowed.", { status: 400 });
    }

    //generate unique file name
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(UPLOAD_DIR, filename);

    //save fike to disk
    const fileBuffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(fileBuffer));

    //add job to queue for processing
    const job=await pdfQueue.add("process-pdf", {
      filename,
      filepath,
      orignalName: file.name,
      size:file.size,
      type:file.type,
      uploadedAt: new Date().toISOString(),
    });

    //return file details with job ID
    return Response.json({
      id: filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      url: `/api/pdf/${filename}`,
      jobId: job.id,
      jobStatus: 'queued'
    }, { status: 201 })
  }
  catch (error) {
    console.error("Error uploading file:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Handle search requests
async function handleSearch(req: Request) {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response("Method not allowed. Use POST.", { status: 405 });
    }

    // Define the type for the request body
    interface SearchRequestBody {
      query: string;
      collection?: string;
      limit?: number;
    }

    // Parse the request body with type assertion
    const body = await req.json() as SearchRequestBody;
    const { query, collection, limit = 5 } = body;

    if (!query) {
      return new Response("Query is required", { status: 400 });
    }

    // If collection is not specified, search across all PDF collections
    let collectionsToSearch: string[] = [];
    
    if (collection) {
      // Search in the specified collection
      collectionsToSearch = [collection];
    } else {
      // Get all collections and filter for PDF collections
      const allCollections = await qdrantClient.getCollections();
      collectionsToSearch = allCollections.collections
        .filter(c => c.name.startsWith('pdf_'))
        .map(c => c.name);
    }

    if (collectionsToSearch.length === 0) {
      return new Response("No collections found to search", { status: 404 });
    }

    // Generate embedding for the query using the sidecar service
    // Define interface for embedding response
    interface EmbeddingResponse {
      data: {
        embedding: number[]
      }[];
      dimensions?: number;
      model?: string;
    }

    const embeddingResponse = await fetch(`${TEXT_EXTRACTOR_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: query }),
    });

    if (!embeddingResponse.ok) {
      return new Response("Failed to generate embedding for query", { status: 500 });
    }

    const embeddingData = await embeddingResponse.json() as EmbeddingResponse;
    const queryVector = embeddingData.data?.[0]?.embedding;

    if (!queryVector) {
      return new Response("No embedding generated for the query", { status: 500 });
    }

    // Define interface for search results that matches Qdrant's return type
    interface SearchResult {
      id: number | string;
      version?: number;
      score: number;
      payload: {
        text: string;
        metadata?: any;
        [key: string]: unknown;
      };
      vector?: number[];
      shard_key?: string;
      order_value?: number;
      collection: string;
    }

    // Search each collection and combine results
    let allResults: SearchResult[] = [];
    
    for (const collectionName of collectionsToSearch) {
      try {
        const searchResults = await qdrantClient.search(collectionName, {
          vector: queryVector,
          limit: limit,
          with_payload: true,
        });
        
        // Add collection name to each result with type assertion
        const resultsWithCollection = searchResults.map(result => ({
          ...result,
          collection: collectionName
        })) as SearchResult[];
        
        allResults = [...allResults, ...resultsWithCollection];
      } catch (error: any) {
        console.error(`Error searching collection ${collectionName}:`, error);
        // Continue with other collections
      }
    }

    // Sort all results by score (descending)
    allResults.sort((a, b) => b.score - a.score);
    
    // Limit to the top results
    allResults = allResults.slice(0, limit);

    // Extract the text content from the results
    const contextTexts = allResults.map(result => result.payload.text);

    // Generate a system prompt for Gemini
    const systemPrompt = generateSystemPrompt(query, contextTexts);

    // Call Gemini to generate a response
    try {
      // Try using a different model name
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      // Format the prompt with system instructions and user query
      const prompt = `${systemPrompt}\n\nUser query: ${query}`;
      
      // Generate content with Gemini
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiResponse = response.text();
      
      // Return the search results, system prompt, and AI response
      return Response.json({
        query,
        results: allResults,
        systemPrompt,
        response: aiResponse
      });
    } catch (error: any) {
      console.error("Error generating AI response:", error);
      
      // If the first model fails, try with a different model
      try {
        console.log("First model failed, trying with gemini-pro-1.0...");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro-1.0" });
        const result = await fallbackModel.generateContent(prompt);
        const response = await result.response;
        const aiResponse = response.text();
        
        return Response.json({
          query,
          results: allResults,
          systemPrompt,
          response: aiResponse
        });
      } catch (fallbackError: any) {
        console.error("Fallback model also failed:", fallbackError);
        
        return Response.json({
          query,
          results: allResults,
          error: "Failed to generate AI response",
          errorDetails: error.message,
          fallbackError: fallbackError.message
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error handling search:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Generate a system prompt based on the query and retrieved context
function generateSystemPrompt(query: string, contextTexts: string[]): string {
  // Combine the context texts with separators
  const combinedContext = contextTexts.map((text, index) => 
    `Context ${index + 1}:\n${text}`
  ).join('\n\n');

  // Create a system prompt that instructs the AI how to use the context
  return `You are an AI assistant that provides accurate and helpful information based on the provided context.
  
CONTEXT INFORMATION:
${combinedContext}

INSTRUCTIONS:
1. Answer the user's question based ONLY on the information provided in the context above.
2. If the context doesn't contain enough information to fully answer the question, acknowledge this limitation.
3. If the context contains conflicting information, point this out and explain the different perspectives.
4. Format your response in a clear, concise, and well-structured manner.
5. If appropriate, use markdown formatting to improve readability.
6. Do not reference the context directly in your answer (e.g., don't say "According to Context 1...").
7. Do not make up information that isn't supported by the context.
8. If the user asks for something completely unrelated to the context, politely explain that you can only provide information related to the documents in the knowledge base.

The user's question is: "${query}"

Please provide a comprehensive and accurate response based on the context.`;
}

console.log(`Server running at http://localhost:${server.port} in ${NODE_ENV} mode`);