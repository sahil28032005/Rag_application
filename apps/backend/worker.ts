import { Worker } from "bullmq";
imort { join } from "node:path";
import { existsSync } from "node:fs";

// Redis connection settings
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

//create worker
const worker = new Worker("pdf-processing", async (job) => {
    console.log(`processing job ${job.id}: ${job.data.filename}`);

    try {
        //uppdate job progress
        job.updateProgress(10);

        const { filename, filepath } = job.data;
        //check if file exists
        if (!existsSync(filepath)) {
            throw new Error("File not found");
        }

        //update job progress
        job.updateProgress(30);

        // Here you would implement your PDF processing logic
        // For example:
        // 1. Extract text from PDF
        // 2. Parse metadata
        // 3. Generate thumbnails
        // 4. Store results in database
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update job progress
        await job.updateProgress(70);

        // More processing...
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update job progress
        await job.updateProgress(100);

        // Return processing results
        return {
            status: 'completed',
            filename,
            processedAt: new Date().toISOString(),
            // Add more processing results here
        };

    }
    catch (e) {
        console.log(e);
    }
}, {
    connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
    },
    // Concurrency: how many jobs to process at once
    concurrency: 2,
});

worker.on('completed', job => {
    console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
});
console.log('PDF processing worker started');
