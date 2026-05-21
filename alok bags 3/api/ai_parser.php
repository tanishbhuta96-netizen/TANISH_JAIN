<?php
/* ═══════════════════════════════════════════
   ALOK BAGS — AI Invoice Parser API
   Uses Gemini API (or similar) to parse OCR text
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

// Ensure you have defined GEMINI_API_KEY in config.php or environment
// define('GEMINI_API_KEY', 'your_actual_api_key_here');

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$ocrText = $data['text'] ?? '';

if (empty($ocrText)) {
    jsonResponse(['error' => 'No text provided for AI analysis'], 400);
}

$apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';

// If no API key is configured, fallback to our heuristic mock parser
if (empty($apiKey) || $apiKey === 'YOUR_API_KEY_HERE') {
    jsonResponse([
        'error' => 'No API Key configured. Please add define("GEMINI_API_KEY", "your_key"); in config.php.',
        'fallback_required' => true
    ]);
    exit;
}

// Prepare the prompt exactly as requested by the user
$systemPrompt = 'You are an intelligent invoice parser for a business accounting system.

Extract structured purchase bill data from raw OCR text.

Rules:
- Return only valid JSON without any markdown formatting (no ```json ... ```)
- Detect vendor name, invoice number, date
- Extract all items with qty, rate, GST, amount
- Ensure numeric values are clean numbers
- Calculate missing values if needed
- Validate total = sum of items
- If unsure, mark field as "uncertain"

Output format:
{
  "vendor_name": "",
  "invoice_number": "",
  "date": "",
  "items": [
    {
      "name": "",
      "qty": 0,
      "rate": 0,
      "gst": 0,
      "amount": 0,
      "confidence": 0.0
    }
  ],
  "total_amount": 0,
  "confidence_overall": 0.0,
  "warnings": []
}

Raw OCR Text to parse:
';

$prompt = $systemPrompt . "\n" . $ocrText;

// Call Gemini API
$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . $apiKey;

$payload = json_encode([
    'contents' => [
        ['parts' => [['text' => $prompt]]]
    ],
    'generationConfig' => [
        'temperature' => 0.1, // Low temperature for factual extraction
        'responseMimeType' => 'application/json'
    ]
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For local XAMPP issues

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error || $httpCode !== 200) {
    jsonResponse([
        'error' => 'AI API Error: ' . ($error ? $error : "HTTP $httpCode"),
        'raw_response' => $response,
        'fallback_required' => true
    ], 500);
}

// Parse Gemini Response
$resData = json_decode($response, true);
$aiText = $resData['candidates'][0]['content']['parts'][0]['text'] ?? '';

// Sometimes LLMs return json wrapped in markdown block
$aiText = preg_replace('/^```json\s*/i', '', $aiText);
$aiText = preg_replace('/\s*```$/i', '', $aiText);

$parsedJson = json_decode($aiText, true);

if (!$parsedJson) {
    jsonResponse([
        'error' => 'Failed to parse AI JSON response',
        'raw_text' => $aiText,
        'fallback_required' => true
    ], 500);
}

jsonResponse($parsedJson);
?>
