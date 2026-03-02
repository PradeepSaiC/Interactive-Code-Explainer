import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { prompt, code } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "API key not configured" },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        // Support both explanation (prompt only) and block splitting (prompt + code)
        const contents = code ? prompt + '\n\nCode:\n' + code : prompt;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents,
        });

        return NextResponse.json({ text: response.text });
    } catch (error: any) {
        console.error("Gemini API Error in proxy:", error);

        // Pass through 429 status for rate limiting if applicable
        const status = error.status === 429 || error.message?.includes("429") ? 429 : 500;

        return NextResponse.json(
            { error: error.message || "Failed to generate content" },
            { status }
        );
    }
}
