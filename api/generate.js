const fs = require("fs");
const path = require("path");
const os = require("os");

// Raw Vercel serverless handler - no Express
module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let topic = "";
  let difficulty = "short";
  let extractedText = "";
  let uploadedFilePath = null;

  try {
    const contentType = req.headers["content-type"] || "";
    const isMultipart = contentType.includes("multipart/form-data");

    if (isMultipart) {
      const formidable = require("formidable-serverless");
      const form = new formidable.IncomingForm();
      form.maxFileSize = 4 * 1024 * 1024;
      form.uploadDir = path.join(os.tmpdir(), "uploads");

      const [fields, files] = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      });

      topic = (fields.topic && (Array.isArray(fields.topic) ? fields.topic[0] : fields.topic)) || "";
      difficulty = (fields.difficulty && (Array.isArray(fields.difficulty) ? fields.difficulty[0] : fields.difficulty)) || "short";
      const file = files.file && (Array.isArray(files.file) ? files.file[0] : files.file);
      const filePath = file && (file.filepath || file.path);
      if (filePath) {
        uploadedFilePath = filePath;
        const mimetype = (file.mimetype || file.type) || "";
        if (mimetype === "application/pdf") {
          const pdfParse = require("pdf-parse");
          const buffer = fs.readFileSync(uploadedFilePath);
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text;
        } else if (mimetype.startsWith("image/")) {
          const Tesseract = require("tesseract.js");
          const result = await Tesseract.recognize(uploadedFilePath, "eng");
          extractedText = result.data.text;
        } else if (mimetype === "text/plain") {
          extractedText = fs.readFileSync(uploadedFilePath, "utf8");
        }
      }
    } else {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }
      const data = JSON.parse(body || "{}");
      topic = data.topic || "";
      difficulty = data.difficulty || "short";
    }

    if (uploadedFilePath) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (e) {}
    }

    const finalContent = (topic && topic.trim()) || extractedText.trim();

    if (!finalContent) {
      return res.status(400).json({
        error: "Please enter a topic or upload a file.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Set OPENAI_API_KEY or GROQ_API_KEY in Vercel Environment Variables.",
      });
    }

    const prompt =
      difficulty === "detailed"
        ? `Generate detailed structured study notes from the following content:\n\n${finalContent}`
        : `Generate short and clear study notes from the following content:\n\n${finalContent}`;

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are a helpful academic assistant.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      }
    );

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data.error?.message || "AI error occurred.",
      });
    }

    const text =
      data.choices?.[0]?.message?.content || "No response generated.";

    res.status(200).json({ notes: text });
  } catch (error) {
    console.error("API ERROR:", error);
    res.status(500).json({
      error: error.message || "Server processing error.",
    });
  }
};
