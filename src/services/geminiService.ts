import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function detectRedactions(imageData: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Detect the following fields in this Certificate of Analysis (COA) document and provide their bounding boxes as percentages (0-100) of the image width and height.
            Fields to detect:
            - Barcode
            - QR Code
            - REPORT NO.
            - ACCOUNT NUMBER
            - TO: (Recipient name and address)
            - Phone
            - PO#:
            - LAB NUMBER:
            - SAMPLE ID:
            
            Return the result as a JSON array of objects with the following structure:
            { "label": "field_name", "text": "detected_text", "x": number, "y": number, "width": number, "height": number }
            Ensure the coordinates are precise for redaction.`,
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: imageData.split(',')[1],
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            text: { type: Type.STRING },
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
          },
          required: ["label", "x", "y", "width", "height"],
        },
      },
    },
  });

  return JSON.parse(response.text || '[]');
}
