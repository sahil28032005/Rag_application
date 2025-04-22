import { Worker } from "bullmq";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "langchain/document";

// Redis connection settings
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

//open ai configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//qdrant configuration
const client = new QdrantClient({
    url: process.env.QDRANT_URL || "http://localhost:6333"
});;

//helper interface for chunking
interface TextChunk {
    text: string;
    metadata: {
        filename: string;
        chunkIndex: number;
        location: string;
    }
}

//create worker
const worker = new Worker("pdf-processing", async (job) => {
    console.log(`processing job ${job.id}: ${job.data.filename}`);

    try {
        //uppdate job progress
        job.updateProgress(10);

        const { filename, filepath } = job.data;

        // Convert local path to container path
        const containerPath = `/app/uploads/${filename}`;
        console.log(`Using container path: ${containerPath}`);
        //check if file exists
        if (!existsSync(filepath)) {
            console.log(`File not found at local path: ${filepath}`);
            console.log(`Trying container path instead`);
        }

        //update job progress
        job.updateProgress(20);

        // Here you would implement your PDF processing logic
        // For example:
        // 1. Extract text from PDF
        const extractedText = await extractTextFromPDF(containerPath);
        console.log(`Extracted ${extractedText.length} characters from ${filename}`);

        job.updateProgress(40);

        // 2 create text chunks using langchains text splitter
        const chunks = await createChunks(extractedText, filename);
        console.log(`Created ${chunks.length} chunks from text`);

        // Log chunk details
        chunks.forEach((chunk, index) => {
            console.log(`\n--- Chunk ${index + 1}/${chunks.length} ---`);
            console.log(`Length: ${chunk.text.length} characters`);
            console.log(`Preview: ${chunk.text.substring(0, 100)}...`);
            console.log(`Metadata:`, chunk.metadata);
        });

        // Update job progress
        await job.updateProgress(60);

        //3 convert chunked data into vector assects by openai model
        console.log("Converting chunks to vector embeddings...");
        const collectionName = `pdf_${filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_")}`;
        
        // Create collection if it doesn't exist
        try {
            const collections = await client.getCollections();
            const collectionExists = collections.collections.some(c => c.name === collectionName);
            
            if (!collectionExists) {
                console.log(`Creating new collection: ${collectionName}`);
                await client.createCollection(collectionName, {
                    vectors: {
                        size: 1536, // OpenAI embeddings dimension
                        distance: "Cosine"
                    }
                });
            } else {
                console.log(`Collection ${collectionName} already exists`);
            }
            
            // Process chunks and create embeddings
            const points = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (!chunk) {
                    console.log(`Skipping undefined chunk at index ${i}`);
                    continue;
                }
                
                // Generate embedding using OpenAI with retry logic
                let embeddingResponse;
                let retryCount = 0;
                const maxRetries = 3;
                const initialDelay = 2000; // 2 seconds
                
                while (retryCount <= maxRetries) {
                    try {
                        // Generate embedding using OpenAI
                        embeddingResponse = await openai.embeddings.create({
                            model: "text-embedding-ada-002",
                            input: chunk.text
                        });
                        break; // Success, exit retry loop
                    } catch (error) {
                        if ((error as { status?: number }).status === 429) {
                            retryCount++;
                            if (retryCount > maxRetries) {
                                console.log(`Failed after ${maxRetries} retries. Giving up on chunk ${i+1}.`);
                                throw error; // Rethrow after max retries
                            }
                            
                            const delay = initialDelay * Math.pow(2, retryCount - 1); // Exponential backoff
                            console.log(`Rate limit hit. Retrying in ${delay/1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        } else {
                            // Not a rate limit error, rethrow immediately
                            throw error;
                        }
                    }
                }
                
                // Check if the response contains data
                if (!embeddingResponse || !embeddingResponse.data || embeddingResponse.data.length === 0) {
                    console.log(`No embedding returned for chunk ${i+1}. Skipping.`);
                    continue;
                }
                
                const embedding = embeddingResponse.data[0]!.embedding;
                
                // Debug: Log embedding information
                console.log(`\n--- Embedding for Chunk ${i+1} ---`);
                console.log(`Embedding dimensions: ${embedding.length}`);
                console.log(`First 5 values: [${embedding.slice(0, 5).join(', ')}]`);
                console.log(`Last 5 values: [${embedding.slice(-5).join(', ')}]`);
                console.log(`Min value: ${Math.min(...embedding)}`);
                console.log(`Max value: ${Math.max(...embedding)}`);
                console.log(`Average value: ${embedding.reduce((a, b) => a + b, 0) / embedding.length}`);
                
                // Create point for Qdrant
                points.push({
                    id: `${filename}_chunk_${i}`,
                    vector: embedding,
                    payload: {
                        text: chunk.text,
                        metadata: chunk.metadata
                    }
                });
                
                // Update progress incrementally
                const progressIncrement = 30 / chunks.length;
                await job.updateProgress(60 + (progressIncrement * (i + 1)));
                
                console.log(`Processed embedding for chunk ${i+1}/${chunks.length}`);
            }
            
            // Upload points to Qdrant in batches if there are many
            if (points.length > 0) {
                const batchSize = 100;
                for (let i = 0; i < points.length; i += batchSize) {
                    const batch = points.slice(i, i + batchSize);
                    await client.upsert(collectionName, {
                        points: batch
                    });
                    console.log(`Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(points.length/batchSize)}`);
                }
            }
            
            console.log(`Successfully stored ${points.length} vector embeddings in collection ${collectionName}`);
        } catch (error) {
            console.error("Error creating vector embeddings:", error);
            throw error;
        }

        // More processing...
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update job progress
        await job.updateProgress(100);

        // Return processing results
        return {
            status: 'completed',
            filename,
            processedAt: new Date().toISOString(),
            textLength: extractedText.length,
            chunks: chunks,
            numChunks: chunks.length
        };

    }
    catch (e) {
        console.log(e);
        throw e; // Re-throw to trigger the failed event
    }
}, {
    connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
    },
    // Concurrency: how many jobs to process at once
    concurrency: 2,
});

async function createChunks(text: string, filename: string): Promise<TextChunk[]> {
    // Initialize the text splitter with specific parameters
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        lengthFunction: (text: string) => text.length,
        separators: ["\n\n", "\n", " ", ""] // Order from most to least preferred splitting points
    });

    // Split the text into chunks
    const rawChunks = await textSplitter.createDocuments(
        [text],
        [{ filename, source: filename }]
    ) as Document[];

    // Convert to our TextChunk format with proper typing
    return rawChunks.map((chunk: Document, index: number) => ({
        text: chunk.pageContent,
        metadata: {
            filename,
            chunkIndex: index,
            location: `chunk-${index + 1}`,
            ...chunk.metadata
        }
    }));
}

async function extractTextFromPDF(filepath: string): Promise<string> {
    const textExtractorUrl = process.env.TEXT_EXTRACTOR_URL || 'http://localhost:5000';

    // Trim spaces from filepath
    const trimmedFilepath = filepath.trim();

    try {
        const response = await fetch(`${textExtractorUrl}/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filepath: trimmedFilepath }),
        });

        if (!response.ok) {
            const errorData = await response.json() as { error?: string };
            throw new Error(`Text extraction failed: ${errorData.error || response.statusText}`);
        }

        const data = await response.json() as { text: string };
        return data.text;
    } catch (error) {
        console.error('Error extracting text:', error);
        throw error;
    }
}


worker.on('completed', job => {
    console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
});
console.log('PDF processing worker started');
