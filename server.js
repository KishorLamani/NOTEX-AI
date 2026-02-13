const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const pdfParse = require("pdf-parse"); // use v1.1.1
const Tesseract = require("tesseract.js");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* ---------------- FILE UPLOAD CONFIG ---------------- */

const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
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

app.post("/generate", upload.single("file"), async (req, res) => {
    const { topic, difficulty } = req.body;
    let extractedText = "";

    try {
        // If file uploaded
        if (req.file) {
            const filePath = req.file.path;

            // PDF
            if (req.file.mimetype === "application/pdf") {
                const buffer = fs.readFileSync(filePath);
                const pdfData = await pdfParse(buffer);
                extractedText = pdfData.text;
            }

            // Image OCR
            else if (req.file.mimetype.startsWith("image/")) {
                const result = await Tesseract.recognize(filePath, "eng");
                extractedText = result.data.text;
            }

            // TXT file
            else if (req.file.mimetype === "text/plain") {
                extractedText = fs.readFileSync(filePath, "utf8");
            }

            // Delete file after processing
            fs.unlinkSync(filePath);
        }

        const finalContent = topic || extractedText;

        if (!finalContent) {
            return res.status(400).json({
                error: "Please enter a topic or upload a file."
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
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`
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
            console.log("GROQ ERROR:", data);
            return res.status(response.status).json({
                error: data.error?.message || "AI error occurred."
            });
        }

        const text =
            data.choices?.[0]?.message?.content ||
            "No response generated.";

        res.json({ notes: text });

    } catch (error) {
        console.log("SERVER ERROR:", error);

        if (error.message.includes("File too large")) {
            return res.status(400).json({
                error: "File size must be under 5MB."
            });
        }

        res.status(500).json({
            error: "Server processing error."
        });
    }
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
