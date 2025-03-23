const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const { PDFDocument } = require('pdf-lib');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({ apiKey: 'your-openai-api-key' });

// Serve the frontend
app.use(express.static('public'));

// Handle file upload and question
app.post('/ask', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const question = req.body.question;

    try {
        // Extract text from the file
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        let text = '';

        switch (fileExtension) {
            case '.pdf':
                const pdfBytes = fs.readFileSync(filePath);
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const pages = pdfDoc.getPages();
                text = pages.map(page => page.getTextContent().then(textContent => 
                    textContent.items.map(item => item.str).join(' ')
                )).join(' ');
                break;
            case '.docx':
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
                break;
            case '.txt':
                text = fs.readFileSync(filePath, 'utf8');
                break;
            default:
                return res.status(400).json({ error: 'Unsupported file type.' });
        }

        // Use OpenAI to answer the question
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: `Context: ${text}\nQuestion: ${question}` },
            ],
        });

        const answer = response.choices[0].message.content;
        res.json({ answer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing the file.' });
    } finally {
        // Delete the uploaded file
        fs.unlinkSync(filePath);
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
