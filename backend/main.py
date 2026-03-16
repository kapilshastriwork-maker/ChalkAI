from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
import os
import json
import asyncio
import urllib.parse

# Load environment variables from .env file
load_dotenv()

# Initialize Google GenAI client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key or api_key == "your_api_key_here":
    raise ValueError("GEMINI_API_KEY not found in .env file. Please set your API key.")

client = genai.Client(api_key=api_key)

# Create FastAPI app
app = FastAPI()

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model for /explain endpoint
class ExplainRequest(BaseModel):
    topic: str

# Request model for /generate-images endpoint
class ImageRequest(BaseModel):
    explanation: str
    topic: str

# Request model for /generate-quiz endpoint
class QuizRequest(BaseModel):
    topic: str
    explanation: str

# GET /health endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "ChalkAI backend is running"}

# POST /explain endpoint (non-streaming fallback)
@app.post("/explain")
async def explain_topic(request: ExplainRequest):
    if not request.topic or not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    
    try:
        # Build the prompt
        prompt = f"""You are an engaging educational explainer like Khan Academy. Explain the following topic clearly and thoroughly in 4-5 paragraphs, using simple language, analogies, and real-world examples. Topic: {request.topic}"""
        
        # Generate response using the new SDK
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        # Extract explanation text
        explanation = response.text
        
        return {"explanation": explanation}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating explanation: {str(e)}")

# POST /explain-stream endpoint (streaming)
@app.post("/explain-stream")
async def explain_topic_stream(request: ExplainRequest):
    if not request.topic or not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    
    def stream_explanation(topic: str):
        try:
            prompt = f"""You are an engaging educational explainer like Khan Academy. Explain the following topic clearly and thoroughly in 4-5 paragraphs, using simple language, analogies, and real-world examples. Topic: {topic}"""
            
            response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=prompt
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Error: {str(e)}"
    
    return StreamingResponse(
        stream_explanation(request.topic),
        media_type="text/plain"
    )

# POST /generate-images endpoint (SVG diagrams)
@app.post("/generate-images")
async def generate_images(request: ImageRequest):
    topic = request.topic
    explanation = request.explanation
    print(f"Generating SVG diagrams for topic: {topic}")
    
    images = []
    
    try:
        # Step 1: Identify 3 visual concepts
        analysis_prompt = f"""
Given this educational explanation about "{topic}", identify exactly 3 key visual concepts for diagrams.

Explanation: {explanation}

Return ONLY a JSON array, no markdown, no backticks:
[
  {{"concept": "concept name", "diagram_description": "what the diagram should show", "paragraph_index": 0}},
  {{"concept": "concept name", "diagram_description": "what the diagram should show", "paragraph_index": 2}},
  {{"concept": "concept name", "diagram_description": "what the diagram should show", "paragraph_index": 4}}
]
"""
        analysis_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=analysis_prompt
        )
        
        raw_text = analysis_response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        concepts = json.loads(raw_text.strip())
        print(f"Concepts: {concepts}")
        
        # Step 2: For each concept, generate an SVG diagram
        for concept in concepts:
            try:
                svg_prompt = f"""You are an expert educational diagram designer. Create a beautiful, clear SVG diagram.

Topic: {concept['diagram_description']}

STRICT REQUIREMENTS - follow every rule exactly:

CANVAS:
- viewBox="0 0 800 500"
- Background: rectangle x=0 y=0 width=800 height=500 fill="#0f1729"

TITLE:
- Add a title bar: rectangle x=0 y=0 width=800 height=50 fill="#1e1b4b"
- Title text: x=400 y=32 text-anchor=middle font-family=Arial font-size=18 font-weight=bold fill="#a78bfa"
- Title should be a SHORT 3-6 word summary of the concept

CONTENT AREA:
- Draw 2-4 main concept boxes
- Each box: rounded rectangle (rx=10), fill="#1e293b", stroke="#7c3aed", stroke-width=2
- Box title text: font-size=14 font-weight=bold fill="#e2e8f0" font-family=Arial
- Box body text: font-size=12 fill="#94a3b8" font-family=Arial
- Keep all text INSIDE their boxes - check x,y coordinates carefully

ARROWS:
- Use path elements with marker-end for arrows
- Define arrowhead marker in defs: id="arrow" fill="#7c3aed"
- Arrow paths: stroke="#7c3aed" stroke-width=2 fill=none
- Label arrows with short text: font-size=11 fill="#a78bfa" font-family=Arial
- Place arrow labels BESIDE arrows, never overlapping boxes

COLOR CODING - use these fills for variety:
- Primary boxes: fill="#1e293b" stroke="#7c3aed"  
- Secondary boxes: fill="#172033" stroke="#3b82f6"
- Highlight boxes: fill="#1a1040" stroke="#22c55e"

ICONS - use simple SVG shapes as icons inside boxes:
- Sun: circle with lines radiating out
- Atom: circle with ellipse orbits
- Arrow: simple polygon
- Gear: circle with rectangles around edge

LAYOUT RULES:
- Space boxes evenly - minimum 20px gap between any elements
- No text should overflow its container box
- Keep all elements within x=10 to x=790, y=60 to y=490
- Maximum 3 lines of text per box, each line max 35 characters

ABSOLUTELY NO:
- No markdown, no backticks, no explanation text
- No text overflowing boxes
- No overlapping elements
- No elements outside the viewBox

Return ONLY the raw SVG starting with <svg and ending with </svg>. Nothing else."""

                svg_response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=svg_prompt
                )
                
                svg_text = svg_response.text.strip()
                # Clean up any markdown wrapping
                if "```svg" in svg_text:
                    svg_text = svg_text.split("```svg")[1].split("```")[0].strip()
                elif "```" in svg_text:
                    svg_text = svg_text.split("```")[1].split("```")[0].strip()
                
                # Make sure it starts with <svg
                if "<svg" in svg_text:
                    svg_start = svg_text.index("<svg")
                    svg_text = svg_text[svg_start:]
                
                print(f"SVG generated for: {concept['concept']} ({len(svg_text)} chars)")
                
                images.append({
                    "concept": concept["concept"],
                    "paragraph_index": concept["paragraph_index"],
                    "svg": svg_text,
                    "type": "svg"
                })
                
            except Exception as e:
                print(f"Error generating SVG for {concept['concept']}: {e}")
                continue
    
    except Exception as e:
        print(f"Error in generate_images: {e}")
    
    return {"images": images}

# POST /generate-quiz endpoint
@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    topic = request.topic
    explanation = request.explanation
    
    quiz_prompt = f"""Based on this educational explanation about "{topic}", create exactly 3 multiple choice questions to test understanding.

Explanation: {explanation}

Return ONLY a JSON array, no markdown, no backticks, no explanation:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0,
    "explanation": "Brief explanation of why this answer is correct"
  }},
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 2,
    "explanation": "Brief explanation of why this answer is correct"
  }},
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 1,
    "explanation": "Brief explanation of why this answer is correct"
  }}
]

Rules:
- Questions must test understanding of the explanation, not trivia
- Each question must have exactly 4 options
- correct_index is 0-based (0=A, 1=B, 2=C, 3=D)
- Make wrong options plausible, not obviously wrong
- Keep questions clear and concise
"""
    
    try:
        response = await asyncio.wait_for(
            client.models.generate_content(
                model="gemini-2.5-flash",
                contents=quiz_prompt
            ),
            timeout=30.0
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        questions = json.loads(raw.strip())
        print(f"Quiz generated: {len(questions)} questions")
        return {"questions": questions}
    except asyncio.TimeoutError:
        print("Quiz generation timed out after 30 seconds")
        return {"questions": [], "error": "Timeout generating quiz"}
    except Exception as e:
        print(f"Quiz generation error: {e}")
        return {"questions": [], "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
