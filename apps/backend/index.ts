import { serve } from "bun";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync, stat } from "node:fs";
import { Queue } from "bullmq";
import { createClient } from "redis";
import { url } from "node:inspector";

// Access environment variables
const PORT = parseInt(process.env.PORT || "3001");
const NODE_ENV = process.env.NODE_ENV || "development";

// Redis connection settings
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

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

    //get pdf details endoint
    

    // Handle 404
    return new Response("Not Found", { status: 404 });
  },
});

//handle pdf upload
async function handleUpload(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

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

console.log(`Server running at http://localhost:${server.port} in ${NODE_ENV} mode`);