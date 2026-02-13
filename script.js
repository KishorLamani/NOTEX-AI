// ---------------- GENERATE NOTES ----------------

async function generateNotes() {
    const topic = document.getElementById("topicInput").value.trim();
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];
    const difficulty = document.getElementById("difficulty").value;

    const loading = document.getElementById("loading");
    const outputSection = document.getElementById("outputSection");
    const notesOutput = document.getElementById("notesOutput");

    // Clear previous output
    notesOutput.innerHTML = "";
    outputSection.classList.add("hidden");

    // Validate input
    if (!topic && !file) {
        alert("Please enter a topic or upload a file.");
        return;
    }

    // Validate file size (5MB max)
    if (file && file.size > 5 * 1024 * 1024) {
        alert("File size must be under 5MB.");
        fileInput.value = "";
        return;
    }

    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("difficulty", difficulty);

    if (file) {
        formData.append("file", file);
    }

    try {
        loading.classList.remove("hidden");

        const response = await fetch("/generate", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        loading.classList.add("hidden");

        if (!response.ok) {
            alert(data.error || "Error generating notes.");
            return;
        }

        outputSection.classList.remove("hidden");

        // Convert markdown-like text to styled HTML
        let formatted = data.notes
            .replace(/^### (.*$)/gim, "<h4>$1</h4>")
            .replace(/^## (.*$)/gim, "<h3>$1</h3>")
            .replace(/^\* (.*$)/gim, "<li>$1</li>")
            .replace(/^\- (.*$)/gim, "<li>$1</li>")
            .replace(/\n/g, "<br>");

        notesOutput.innerHTML = formatted;

    } catch (error) {
        loading.classList.add("hidden");
        alert("Server error. Please try again.");
        console.error(error);
    }
}

// ---------------- COPY NOTES ----------------

function copyNotes() {
    const text = document.getElementById("notesOutput").innerText;

    navigator.clipboard.writeText(text)
        .then(() => {
            alert("Notes copied successfully!");
        })
        .catch(() => {
            alert("Failed to copy notes.");
        });
}

// ---------------- DOWNLOAD PDF ----------------

async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const text = document.getElementById("notesOutput").innerText;

    if (!text) {
        alert("No notes to download.");
        return;
    }

    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 10, 10);

    doc.save("AI_Study_Notes.pdf");
}

// ---------------- CLOSE NOTES ----------------

function closeNotes() {
    document.getElementById("outputSection").classList.add("hidden");
    document.getElementById("notesOutput").innerHTML = "";
    document.getElementById("topicInput").value = "";
    document.getElementById("fileInput").value = "";
}
