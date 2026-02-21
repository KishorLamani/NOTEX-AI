const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");
// Lazy-load heavy deps only when file is uploaded (avoids Vercel cold-start crash)

const app = express();

app.use(cors());
app.use(express.json());

/* ---------------- FILE UPLOAD - Use /tmp for Vercel serverless ---------------- */
const uploadDir = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB (Vercel default body limit ~4.5MB)
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "text/plain"
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, PNG, JPG, and TXT files allowed."));
        }
    }
});

/* ---------------- GENERATE ROUTE ---------------- */
app.post("/", upload.single("file"), async (req, res) => {
    const { topic, difficulty } = req.body || {};
    let extractedText = "";

    try {
        if (req.file) {
            const filePath = req.file.path;

            if (req.file.mimetype === "application/pdf") {
                const pdfParse = require("pdf-parse");
                const buffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(buffer);
                extractedText = pdfData.text;
            } else if (req.file.mimetype.startsWith("image/")) {
                const Tesseract = require("tesseract.js");
                const result = await Tesseract.recognize(filePath, "eng");
                extractedText = result.data.text;
            } else if (req.file.mimetype === "text/plain") {
                extractedText = fs.readFileSync(filePath, "utf8");
            }

            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                /* ignore cleanup errors */
            }
        }

        const finalContent = topic || extractedText;

        if (!finalContent) {
            return res.status(400).json({
                error: "Please enter a topic or upload a file."
            });
        }

        const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: "Server configuration error: Set OPENAI_API_KEY or GROQ_API_KEY in Vercel Environment Variables."
            });
        }

        const prompt =
            difficulty === "detailed"
                ? `Generate detailed structured study notes from the following content:\n\n${finalContent}`
                : `Generate short and clear study notes from the following content:\n\n${finalContent}`;

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful academic assistant."
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("GROQ ERROR:", data);
            return res.status(response.status).json({
                error: data.error?.message || "AI error occurred."
            });
        }

        const text =
            data.choices?.[0]?.message?.content || "No response generated.";

        res.json({ notes: text });
    } catch (error) {
        console.error("SERVER ERROR:", error);

        if (error.message && error.message.includes("File too large")) {
            return res.status(400).json({
                error: "File size must be under 4MB on Vercel."
            });
        }

        res.status(500).json({
            error: "Server processing error."
        });
    }
});

// Ensure Multer and other errors return JSON (not HTML)
app.use((err, req, res, next) => {
    console.error("Middleware error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Server processing error."
    });
});

module.exports = app;
