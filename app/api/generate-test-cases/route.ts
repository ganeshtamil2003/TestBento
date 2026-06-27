import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { requirement, storyTitle, acceptanceCriteria, count = 5 } = await req.json();

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement description is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    // Use Gemini 2.5 Flash for fast generation
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
You are an expert QA Engineer. Generate exactly ${count} test cases based on the provided requirements.

Context:
- User Story: ${storyTitle || 'N/A'}
- Description: ${requirement}
- Acceptance Criteria: ${acceptanceCriteria || 'N/A'}

Your output MUST be a strict JSON array of test cases. Each test case MUST follow this schema exactly, and nothing else:
[
  {
    "title": "Clear, descriptive test case title",
    "description": "Brief description of what is being tested",
    "preconditions": "What must be set up before this test (can be empty string)",
    "postconditions": "What is the state after this test (can be empty string)",
    "steps": [
      {
        "step_number": 1,
        "action": "What the user does",
        "test_data": "Any specific data used (optional, can be empty)",
        "expected_result": "What should happen"
      }
    ],
    "expected_result": "Overall expected result of the test case",
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "automation_status": "MANUAL" | "AUTOMATED" | "SEMI_AUTOMATED"
  }
]

Ensure that the output is exactly a valid JSON array and adheres to the types strictly. Priority should be one of "HIGH", "MEDIUM", "LOW". Execution type should be one of "MANUAL", "AUTOMATED", "SEMI_AUTOMATED".
`;


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
      // In case the LLM returned markdown wrapped JSON despite mime-type
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        parsedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Normalize array shape and append the isSelected flag for UI
    if (!Array.isArray(parsedData)) {
       // If the model returned an object with a property containing the array
       parsedData = Object.values(parsedData).find(Array.isArray) || [];
    }

    const finalData = parsedData.map(tc => ({ ...tc, isSelected: true }));

    return NextResponse.json({ testCases: finalData });
  } catch (error: any) {
    console.error("Error generating test cases:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate test cases' }, { status: 500 });
  }
}
