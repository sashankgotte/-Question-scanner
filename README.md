# AI Question Scanner

Scan a question, understand the solution, and learn the idea behind it.

## Start locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` on the server only.
3. Start the API in one terminal with `npm run server`.
4. Start the web app in another terminal with `npm run dev` and open the Vite URL.

The API listens on port 3001. Set `APP_ORIGIN` to the exact frontend origin when it differs from the local Vite defaults. Keep `.env` private; `.gitignore` excludes it. The Gemini key is never sent to the browser.

## Included

- Camera capture with review, rotate, crop-to-frame, retake, and device-supported flash.
- Image, PDF, and typed-question submission, with file type and 12 MB size checks.
- Gemini question reading, subject/topic detection, explanation, steps, and a separate solution-verification request.
- Contextual tutor chat, English/Hindi/Telugu answer language, and browser speech playback.
- Local question history and a progress view; uploaded files are not retained in history.
- A development-only Vite proxy routes `/api` requests to the Express server.

PDFs are sent to Gemini as uploaded documents; results depend on the configured Gemini model and its document-reading limits. Batch solving sends the extracted questions sequentially, stopping if any question fails. It is not a guaranteed bulk-processing service.

## Not connected yet

User accounts, cloud sync, secure code execution, handwriting/diagram recognition, and adaptive practice scoring require additional services and are intentionally not simulated. Accuracy figures are not fabricated; the app reports qualitative OCR/verification confidence returned by the model.
