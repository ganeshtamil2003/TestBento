import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { title, description, steps, dataStyle } = await req.json();

    if (!title || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'Title and steps are required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const stylePrompt = dataStyle === 'Edge Cases' 
      ? 'Focus exclusively on edge cases, boundary values, and unusual inputs.'
      : dataStyle === 'Security'
      ? 'Focus exclusively on security vulnerabilities like SQL injection, XSS, payload limits, and malicious inputs.'
      : 'Focus on standard, valid "happy path" data that represents normal user behavior.';

    const stepsContext = steps.map((s: any) => `Step ${s.step_number}: Action: "${s.action}" | Current Expected Result: "${s.expected_result}"`).join('\n');

    const prompt = `
You are an expert QA Engineer. Your task is to generate specific, concrete \`test_data\` for a manual test case.

Context:
- Test Case Title: ${title}
- Description: ${description || 'N/A'}
- Data Style Requested: ${stylePrompt}

Test Steps:
${stepsContext}

Your output MUST be a strict JSON array of strings. Each string in the array corresponds to the \`test_data\` for the step at that index.
If a step does not naturally require test data (e.g., "Click the login button"), return an empty string "" for that step.
If a step requires data (e.g., "Enter username and password"), return a concise string representing the data (e.g., "username: test_user, password: Password123!").

Your response MUST be a valid JSON array of strings matching the length of the provided steps exactly (${steps.length} items). Example output:
[
  "user@example.com, Password123!",
  "",
  "{ \\"item_id\\": 42, \\"qty\\": 1 }"
]
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    let result;
    let retries = 2;
    while (retries >= 0) {
      try {
        result = await model.generateContent(prompt);
        break; // Success
      } catch (e: any) {
        if (retries === 0) throw e;
        console.log(`Fetch failed, retrying... (${retries} left)`);
        await new Promise(r => setTimeout(r, 1000));
        retries--;
      }
    }
    
    if (!result) throw new Error("Failed to get response from AI");
    const text = result.response.text();
    
    let parsedData = [];
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        parsedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    if (!Array.isArray(parsedData) || parsedData.length !== steps.length) {
       throw new Error('AI returned invalid data shape or mismatched length');
    }

    return NextResponse.json({ testData: parsedData });
  } catch (error: any) {
    console.error("Error generating test data:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate test data' }, { status: 500 });
  }
}
