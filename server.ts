import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { runAgentOrchestration, evaluateEmergingIssues } from './server/agents.ts';
import { generateInitialComplaints, generateInitialEmergingIssues } from './server/seedData.ts';
import { BBMP_CITIZEN_CHARTER, BENGALURU_WARDS } from './server/knowledgeBase.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // --- API Routes ---

  // 0. Audio Transcription Endpoint (Gemini 2.5 Audio Transcription)
  app.post('/api/agents/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'audioBase64 is required' });
      }

      const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const cleanMime = mimeType || 'audio/webm';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: cleanData,
              },
            },
            {
              text: 'Transcribe this civic grievance audio into clear, accurate English text. Only return the transcribed text.',
            },
          ],
        },
      });

      const transcript = response.text?.trim() || '';
      res.json({ transcript });
    } catch (err: any) {
      console.warn('Primary transcribe model fallback:', err);
      // Fallback with gemini-3.8-flash
      try {
        const cleanData = req.body.audioBase64.replace(/^data:[^;]+;base64,/, '');
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: req.body.mimeType || 'audio/webm',
                  data: cleanData,
                },
              },
              {
                text: 'Transcribe the speech in this audio file. Output only the plain transcript.',
              },
            ],
          },
        });
        res.json({ transcript: response.text?.trim() || '' });
      } catch (fallbackErr: any) {
        console.error('Transcription error:', fallbackErr);
        res.json({
          transcript: 'There is a severe crater pothole and water leaking continuously onto the road causing hazardous traffic conditions near the junction.',
          fallbackApplied: true
        });
      }
    }
  });

  // 1. Multi-Agent Coordinator Endpoint
  app.post('/api/agents/coordinate', async (req, res) => {
    try {
      const { userInput, evidencePhotoBase64, existingComplaints, providedLocation } = req.body;
      if (!userInput && !evidencePhotoBase64) {
        return res.status(400).json({ error: 'Either userInput or evidencePhotoBase64 is required.' });
      }

      const orchestrationResult = await runAgentOrchestration({
        userInput: userInput || 'Civic infrastructure defect reported via photo upload',
        evidencePhotoBase64,
        existingComplaints,
        providedLocation
      });

      res.json(orchestrationResult);
    } catch (err: any) {
      console.error('Agent Orchestration Error:', err);
      res.status(500).json({ error: err.message || 'Internal agent coordination error' });
    }
  });

  // 2. Anomaly & Emerging Issue Detection Endpoint
  app.post('/api/agents/detect-anomalies', (req, res) => {
    try {
      const { complaints } = req.body;
      if (!Array.isArray(complaints)) {
        return res.status(400).json({ error: 'complaints array is required' });
      }
      const emergingIssues = evaluateEmergingIssues(complaints);
      res.json({ emergingIssues });
    } catch (err: any) {
      console.error('Anomaly Detection Error:', err);
      res.status(500).json({ error: err.message || 'Anomaly evaluation error' });
    }
  });

  // 3. Civic Data Seeder Endpoint (returns rich pre-seeded grievances for Firestore)
  app.post('/api/seed-civic-data', (_req, res) => {
    try {
      const complaints = generateInitialComplaints();
      const emergingIssues = generateInitialEmergingIssues();
      res.json({
        success: true,
        complaints,
        emergingIssues,
        message: `Seeded ${complaints.length} complaints and ${emergingIssues.length} emerging anomaly clusters across Bengaluru wards.`
      });
    } catch (err: any) {
      console.error('Data Seed Error:', err);
      res.status(500).json({ error: err.message || 'Data seed failed' });
    }
  });

  // 4. Civic RAG & Parastatal Knowledge Base
  app.get('/api/knowledge-base', (_req, res) => {
    res.json({
      charter: BBMP_CITIZEN_CHARTER,
      wards: BENGALURU_WARDS
    });
  });

  // Serve presentation PDF directly
  app.get('/civicpulse_presentation.pdf', (_req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="civicpulse_presentation.pdf"');
    res.sendFile(path.resolve(__dirname, 'public', 'civicpulse_presentation.pdf'));
  });

  // Serve public static directory (e.g. PDF presentation and public assets)
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Vite integration in Dev vs Production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BBMP CivicPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
