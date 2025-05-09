const mime = require("mime-types");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { convertPptxToPdf, convertToPdf } = require("./libre-office");
const { downloadFileFromS3 } = require("./aws-s3");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/** SLIDE
 * Generate slide content using Google AI.
 * Case 1: Short topic
 */
const generateSlideContentWithGoogleAIV1 = async (
  topic, // topicText
  writingTone,
  language,
  numberOfSlides,
  specificRequirements
) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  }); // Or your preferred model

  const prompt = `
    You are a **presentation content generator**.  
    Your task is to create **structured content** for a PowerPoint presentation on the topic: **"${topic}"**.

    # **Presentation Specifications:**
    - **Number of Slides**: ${numberOfSlides ?? "**10**"} slides.
    - **Writing Tone**: The content should be written in a **${
      writingTone ?? "formal"
    }** tone.
    - **Language**: The presentation must be in **${language ?? "English"}**.
    - **Specific Requirements**: ${specificRequirements ?? "**None provided.**"}

    # **Slide Structure:**
    - **Slide Heading**: Provide a clear and concise title for each slide. The heading should not be too long.
    - **Slide Content**: Each slide should have **key bullet points** summarizing the most important information.
    - **Sub-bullet Points**: If necessary, include **sub-bullets** under each main bullet point.
    - **Image Suggestions**: Suggest relevant images only for slides where visuals would enhance understanding. 
      Limit the number of images to **1-3 per slide** (only if necessary), with clear keywords for image searching. 
      **Do NOT suggest images for every slide**.
      - **1 image**: Best for focusing on the key concept of the slide.
      - **2-3 images**: Use when the slide has more complex content that benefits from multiple visuals (e.g., diagrams, examples, or processes).

    # **Expected JSON Output**
    \`\`\`json
    {
        "title": "Presentation Title",
        "slides": [
            {
                "heading": "Slide Title",
                "bulletPoints": [
                    "Main point 1",
                    [
                        "Supporting detail 1",
                        "Supporting detail 2"
                    ],
                    "Main point 2"
                ],
                "imageSuggestions": []
            },
            {
                "heading": "Next Slide Title",
                "bulletPoints": [
                    "Main point",
                    [
                        "Sub-point 1",
                        "Sub-point 2"
                    ]
                ],
                "imageSuggestions": ["keyword1", "keyword2"]
            },
            {
                "heading": "Thank You",
                "bulletPoints": [],
                "imageSuggestions": []
            }
        ]
    }
    \`\`\`

    # **Guidelines for AI:**
    - **Ensure the slide content is structured and logically organized.**
    - **Do NOT add extra commentary or text; only return the JSON response.**
    - **For slides with no images**, limit the total number of bullet points and sub-bullet points to **no more than 8**.
    - **For slides with image suggestions**, limit the total number of both bullet points and sub-bullet points to **no more than 3**.
    - **Make sure the presentation aligns with the required writing tone and language.**
    - **The last "Thank you" slide should be included with no bullet points or images.**
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response;
};

/**
 * SLIDE
 * Generate slide content using Google AI.
 * Case 2: File (docx, pptx, pdf)
 */
const generateSlideContentWithGoogleAIV2 = async (
  file,
  writingTone,
  language,
  numberOfSlides
) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  if (!file || !file.fileUrl) {
    throw new Error("Invalid file object. Ensure fileUrl is provided.");
  }

  // Determine MIME type
  const mimeType = mime.lookup(file.fileUrl);
  if (!mimeType) {
    throw new Error("Cannot determine file MIME type.");
  }

  let uploadedFile = file.fileUrl;
  // Download file from S3 to memory (without saving to disk)
  const fileBuffer = await downloadFileFromS3(file.fileUrl);

  let fileExtension = mime.extension(mimeType);

  if (mimeType !== "application/pdf") {
    uploadedFile = await convertToPdf(fileBuffer, fileExtension);
  } else {
    uploadedFile = fileBuffer;
  }
  // Read file and convert to base64
  const base64File = uploadedFile.toString("base64");

  const prompt = `
    You are an expert **presentation content generator** and **document/image analyzer**.
    Your task is to analyze the provided file (which may contain text or images) and generate structured content for a PowerPoint presentation.

    # **Input File Information**
    - The uploaded file could be a **document (PPTX, DOCX, PDF)** or an **image (PNG, JPG, JPEG, BMP, GIF, WebP)**.
    - If the file contains **textual content**, extract and analyze key information to create structured slides.
    - If the file contains **images**, analyze the visuals and suggest appropriate slide titles, content, and relevant image descriptions.

    # **Presentation Specifications**
    - **Number of Slides**: Generate approximately ${
      numberOfSlides ?? "10"
    } slides.
    - **Writing Tone**: The content should be written in a **${
      writingTone ?? "formal"
    }** tone.
    - **Language**: The presentation must be in **${language ?? "English"}**.
    - **Ensure a logical flow and structured presentation.**

    # **Slide Structure**
    Each slide should contain:
    - **Slide Heading**: Provide a clear and concise title for each slide. The heading should not be too long.
    - **Slide Content**: Key bullet points summarizing important information.
    - **Sub-bullet Points**: Additional supporting details, if necessary.
    - **Image Suggestions**: Suggest relevant images only for slides where visuals would enhance understanding. 
      Limit the number of images to **1-3 per slide** (only if necessary), with clear keywords for image searching. 
      **Do NOT suggest images for every slide**.
      - **1 image**: Best for focusing on the key concept of the slide.
      - **2-3 images**: Use when the slide has more complex content that benefits from multiple visuals (e.g., diagrams, examples, or processes).

    # **If the file is an image**
    - Describe the image's key elements.
    - Extract any text found in the image.
    - Generate slides based on visual and contextual information.

    # **Output Format**
    Please return a structured JSON response in the following format:
    \`\`\`json
    {
        "title": "Generated Presentation Title",
        "slides": [
            {
                "heading": "Slide Title",
                "bulletPoints": [
                    "Main point 1",
                    [
                        "Supporting detail 1",
                        "Supporting detail 2"
                    ],
                    "Main point 2"
                ],
                "imageSuggestions": []
            },
            {
                "heading": "Next Slide Title",
                "bulletPoints": [
                    "Main point",
                    [
                        "Sub-point 1",
                        "Sub-point 2"
                    ]
                ],
                "imageSuggestions": ["keyword1", "keyword2"]
            },
            {
                "heading": "Thank You",
                "bulletPoints": [],
                "imageSuggestions": []
            }
        ]
    }
    \`\`\`

    # **Guidelines for AI**
    - **Ensure each slide is well-structured and logically organized.**
    - **For slides with no images**, limit the total number of bullet points and sub-bullet points to **no more than 8**.
    - **For slides with image suggestions**, limit the total number of both bullet points and sub-bullet points to **no more than 3**.
    - **If the file contains text, analyze and extract key points.**
    - **If the file contains images, describe them and generate related slide content.**
    - **Do NOT add extra commentary; only return the JSON response.**
    - **Ensure alignment with the requested writing tone and language.**
    - **The last "Thank you" slide should be included with no bullet points or images.**
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64File,
        mimeType: "application/pdf",
      },
    },
    prompt,
  ]);

  const response = await result.response;
  return response;
};

/**
 * SLIDE
 * Generate slide content using Google AI from a long paragraph input.
 * Case 3: Long paragraph (topicParagraph)
 */
const generateSlideContentWithGoogleAIV3 = async (
  topicParagraph,
  writingTone,
  language,
  numberOfSlides
) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-03-25",
  }); // Or your preferred model

  const prompt = `
    You are a **presentation content generator**.  
    Your task is to read the following paragraph and create **structured content** for a PowerPoint presentation based on the ideas and concepts it contains.

    # **Paragraph to Analyze:**
    """${topicParagraph}"""
    Carefully analyze the paragraph to identify the main topics, key ideas, and supporting details.
    Do not just extract surface-level keywords—distill the paragraph into meaningful slide topics and structured content.

    # **Presentation Specifications:**
    - **Number of Slides**: ${numberOfSlides ?? "**10**"} slides.
    - **Writing Tone**: The content should be written in a **${
      writingTone ?? "formal"
    }** tone.
    - **Language**: The presentation must be in **${language ?? "English"}**.

    # **Slide Structure:**
    - **Slide Heading**: Provide a clear and concise title for each slide. The heading should not be too long.
    - **Slide Content**: Each slide should have **key bullet points** summarizing the most important information.
    - **Sub-bullet Points**: If necessary, include **sub-bullets** under each main bullet point.
    - **Image Suggestions**: Suggest relevant images only for slides where visuals would enhance understanding. 
      Limit the number of images to **1-3 per slide** (only if necessary), with clear keywords for image searching. 
      **Do NOT suggest images for every slide**.
      - **1 image**: Best for focusing on the key concept of the slide.
      - **2-3 images**: Use when the slide has more complex content that benefits from multiple visuals (e.g., diagrams, examples, or processes).

    # **Expected JSON Output**
    \`\`\`json
    {
        "title": "Presentation Title",
        "slides": [
            {
                "heading": "Slide Title",
                "bulletPoints": [
                    "Main point 1",
                    [
                        "Supporting detail 1",
                        "Supporting detail 2"
                    ],
                    "Main point 2"
                ],
                "imageSuggestions": []
            },
            {
                "heading": "Next Slide Title",
                "bulletPoints": [
                    "Main point",
                    [
                        "Sub-point 1",
                        "Sub-point 2"
                    ]
                ],
                "imageSuggestions": ["keyword1", "keyword2"]
            },
            {
                "heading": "Thank You",
                "bulletPoints": [],
                "imageSuggestions": []
            }
        ]
    }
    \`\`\`

    # **Guidelines for AI:**
    - **Ensure the slide content is structured and logically organized.**
    - **Do NOT add extra commentary or text; only return the JSON response.**
    - **For slides with no images**, limit the total number of bullet points and sub-bullet points to **no more than 8**.
    - **For slides with image suggestions**, limit the total number of both bullet points and sub-bullet points to **no more than 3**.
    - **Make sure the presentation aligns with the required writing tone and language.**
    - **The last "Thank you" slide should be included with no bullet points or images.**
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response;
};

/**
 * LECTURE
 * Generate lecture script using Google AI.
 */
const generateLectureScriptWithGoogleAI = async (
  file,
  academicLevel,
  voiceStyle,
  language,
  lectureLength,
  interactiveQuiz,
  specificRequirements
) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  if (!file || !file.fileUrl) {
    throw new Error("Invalid file object. Ensure fileUrl is provided.");
  }

  // Determine MIME type
  const mimeType = mime.lookup(file.fileUrl);
  if (!mimeType) {
    throw new Error("Cannot determine file MIME type.");
  }

  let uploadedFile = file.fileUrl;
  // Download file from S3 to memory (without saving to disk)
  const fileBuffer = await downloadFileFromS3(file.fileUrl);

  if (mimeType !== "application/pdf") {
    uploadedFile = await convertPptxToPdf(fileBuffer);
  } else {
    uploadedFile = fileBuffer;
  }
  // Read file and convert to base64
  const base64File = uploadedFile.toString("base64");

  const basePrompt = `
        You are an **expert lecturer** who excels at adapting to different learning levels and teaching styles.  
        Your task is to generate a **lecture script** from a **PowerPoint (PPTX) file**.

        # **Lecture Specifications**
        - **Lecture Name**: Generate a short, concise, and relevant name that summarizes the topic (e.g., "Introduction to Quantum Computing", "Basics of Machine Learning").
        - **Learner's Academic Level**: The content should be suitable for **${
          academicLevel ?? "Undergraduate"
        }** students.
        - **Teaching Style**: The lecture should follow a **${
          voiceStyle ?? "Engaging and Easy to Follow"
        }** approach.
        - **Teaching Language**: Deliver the lecture in **${
          language ?? "English"
        }**.
        - **Lecture Length**: Ensure the script of each slide fits the following format: **${
          lectureLength ?? "Normal"
        }** length. 
          If it is "Short", the content should be short, concise and focused on the key points.
          If it is "Normal", the lecture should cover the material in an average length, providing examples and explanations. 
          If it is "Long", the lecture should go into more detail, with deep insights, thorough analysis, and extra examples.
        - **Specific User Requirements**: ${
          specificRequirements ?? "**None provided.**"
        }

        # **Your Task**
        1. **Analyze the attached PowerPoint file**, extract its content and explain/discuss it in a concise and easy-to-understand way.
        2. **Each slide should have EXACTLY ONE comprehensive script, no additional scripts should be created.**
        2. **For each slide, generate a well-structured and easy-to-understand lecture script.**
        3. **Ensure clarity and engagement, aligning with the selected teaching style and academic level.**
        4. **Ensure the script is clean and speech-friendly. Do not use quotation marks (neither " nor '), symbols, special characters, or extra line breaks — keep the content natural and plain for text-to-speech.**
    `;

  const quizPrompt = `
        5. **After every 3-5 slides, include a quiz question to reinforce learning.**
        6. **Each quiz should be directly related to the preceding slides and should assess key concepts.**
        
        # **Expected JSON Output**
        \`\`\`json
        {
            "lectureName": "Lecture name",
            "slides": [
                { "script": "Lecture script for slide 1.", "quiz": null },
                { "script": "Lecture script for slide 2.", "quiz": null },
                { "script": "Lecture script for slide 3.", "quiz": null },
                {
                    "script": "Lecture script for slide 4.",
                    "quiz": {
                        "question": "A quiz question related to previous slides?",
                        "options": ["Option A", "Option B", "Option C", "Option D"],
                        "answer": "Option B"
                    }
                },
                { "script": "Lecture script for slide 5.", "quiz": null },
                { "script": "Lecture script for slide 6.", "quiz": null },
                {
                    "script": "Lecture script for slide 7.",
                    "quiz": {
                        "question": "Another quiz question?",
                        "options": ["Option X", "Option Y", "Option Z", "Option W"],
                        "answer": "Option Y"
                    }
                }
            ]
        }
        \`\`\`

        # **Guidelines for AI**
        - **Do NOT add extra commentary; ONLY return the JSON response.**
        - **Ensure that the script remains engaging, clear, and well-structured.**
        - **If the learner level is beginner, simplify explanations and add examples.**
        - **If the level is advanced, include deeper analysis and technical terms.**
        - **Quiz should appear every 3-5 slides to reinforce key learning points.**
  `;

  const noQuizPrompt = `
        # **Expected JSON Output**
        \`\`\`json
        {
            "slides": [
                { "script": "Lecture script for slide 1." },
                { "script": "Lecture script for slide 2." },
                { "script": "Lecture script for slide 3." },
                { "script": "Lecture script for slide 4." },
                { "script": "Lecture script for slide 5." }
            ]
        }
        \`\`\`

        # **Guidelines for AI**
        - **Ensure that the script remains engaging, clear, and well-structured.**
        - **If the learner level is beginner, simplify explanations and add examples.**
        - **If the level is advanced, include deeper analysis and technical terms.**
  `;

  const prompt = interactiveQuiz
    ? basePrompt + quizPrompt
    : basePrompt + noQuizPrompt;

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64File,
        mimeType: "application/pdf",
      },
    },
    prompt,
  ]);

  const response = await result.response;
  return response;
};

/**
 * QUIZ
 * Version 1
 * Generate quiz from Topic text.
 */
const generateQuizWithGoogleAIV1 = async (
  topic,
  documentText,
  academicLevel,
  language,
  questionType,
  numberOfQuestions,
  specificRequirements
) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-03-25",
  });

  let prompt = "";

  const assumption = `
    You are an expert quiz creator with deep knowledge in various academic fields.
    Your task is to generate a well-structured quiz based on the given parameters. 
    Please make sure the quiz is appropriate for the specified academic level and language.

    For each question, assign points based on the following difficulty scale (from 1 to 10 points):
    - Easy questions: 1-3 points
    - Medium questions: 4-6 points
    - Hard questions: 7-10 points
    Easy questions should be simple factual questions, medium questions should require some reasoning or application, and hard questions should be challenging or involve deeper understanding.

    ${
      specificRequirements &&
      `
      # **Specific Requirements provided by User:**
      Please prioritize the following specific requirements in the quiz generation:
      ${specificRequirements}
      `
    }
    **Important**: If the user provides specific requirements, please **prioritize** them and incorporate them into the quiz. If no specific requirements are given, distribute the questions across the difficulty levels based on a reasonable ratio (for example, 50% Easy, 30% Medium, 20% Hard).

    # **Your Task**
      ${
        documentText &&
        `Analyze the provided paragraph: "${documentText}" and generate a quiz based on the key concepts and information from the text. 
         The quiz should be tailored to assess the learner's understanding of the content at the ${academicLevel} level, ensuring the questions are appropriately challenging for that level. 
         The quiz must be created in the specified language: ${language}.`
      }
      ${
        topic &&
        `Generate a quiz based on the topic: "${topic}", designed to assess the learner's knowledge and understanding at the ${academicLevel} level. 
         The quiz should be tailored to the specified academic level, ensuring the questions are appropriately challenging for learners at that level. 
         The quiz must be created in the specified language: ${language}.
        `
      }
      **Do NOT add extra commentary or text; only return the JSON response.**
  `;

  if (questionType === "multiple choice") {
    prompt = `
      ${assumption}
      The quiz should contain ${numberOfQuestions} questions of type "multiple choice". Each question should have:
        - questionType: "multiple choice"
        - question: The question text
        - options: A list of at least 4 options
        - answer: The correct answer
        - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
        - explanation: A brief explanation of why the answer is correct

      # **Expected JSON Output**
      \`\`\`json
      {
        "quizzes": [
          {
            "questionType": "multiple choice",
            "question": "Who was the leader of Nazi Germany during World War II?",
            "options": ["Adolf Hitler", "Winston Churchill", "Joseph Stalin", "Franklin D. Roosevelt"],
            "answer": "Adolf Hitler",
            "points": 2,
            "explanation": "Adolf Hitler was the dictator of Nazi Germany and played a central role in the start of World War II."
          },
          {
            "questionType": "multiple choice",
            "question": "Which event triggered the United States' entry into World War II?",
            "options": ["Attack on Pearl Harbor", "D-Day landings", "The signing of the Treaty of Versailles", "The invasion of Poland"],
            "answer": "Attack on Pearl Harbor",
            "points": 5,
            "explanation": "The Japanese attack on Pearl Harbor on December 7, 1941, led the United States to declare war on Japan and enter World War II."
          },
          {
            "questionType": "multiple choice",
            "question": "What was the significance of the Battle of Stalingrad?",
            "options": ["It was a turning point in favor of the Axis Powers", "It marked the beginning of the end for Nazi Germany", "It was the first major battle between the Allies and Japan", "It was the battle that led to the fall of France"],
            "answer": "It marked the beginning of the end for Nazi Germany",
            "points": 8,
            "explanation": "The Battle of Stalingrad was a major defeat for Nazi Germany and marked the beginning of a series of Allied victories in Europe."
          }
        ]
      }
      \`\`\`
    `;
  } else if (questionType === "short answer") {
    prompt = `
      ${assumption}
      The quiz should contain ${numberOfQuestions} questions of type "short answer". Each question should have:
        - questionType: "short answer"
        - question: The question text
        - options: Leave empty
        - answer: The correct answer
        - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
        - explanation: If needed, provide an explanation of the answer (can be null)

      # **Expected JSON Output**
      \`\`\`json
      {
        "quizzes": [
          {
            "questionType": "short answer",
            "question": "Who was the Prime Minister of the United Kingdom during most of World War II?",
            "options": [],
            "answer": "Winston Churchill",
            "points": 3,
            "explanation": "Winston Churchill was the British Prime Minister from 1940 to 1945 and again from 1951 to 1955, guiding the UK through the darkest days of WWII."
          },
          {
            "questionType": "short answer",
            "question": "What was the main goal of the Nazi regime during World War II?",
            "options": [],
            "answer": "Expansion and domination of Europe",
            "points": 6,
            "explanation": "The Nazi regime, under Adolf Hitler, aimed to expand Germany's territory across Europe and impose its ideology of racial supremacy."
          },
          {
            "questionType": "short answer",
            "question": "What was the role of the Manhattan Project during World War II?",
            "options": [],
            "answer": "Development of atomic weapons",
            "points": 9,
            "explanation": "The Manhattan Project was a secret U.S. government project aimed at developing atomic bombs, which were later used on Hiroshima and Nagasaki in Japan."
          }
        ]
      }
      \`\`\`
    `;
  } else if (questionType === "multiple choice and short answer") {
    prompt = `
      ${assumption}
      The quiz should contain ${numberOfQuestions} questions with a mix of "multiple choice" and "short answer" questions. Ensure that:
        - Half of the questions are "multiple choice" with at least 4 options, and the other half are "short answer".
        - For "multiple choice" questions:
          - questionType: "multiple choice"
          - question: The question text
          - options: A list of at least 4 options
          - answer: The correct answer
          - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
          - explanation: A brief explanation of why the answer is correct
        - For "short answer" questions:
          - questionType: "short answer"
          - question: The question text
          - options: Leave empty
          - answer: The correct answer
          - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
          - explanation: If needed, provide an explanation of the answer (can be null)

      # **Expected JSON Output**
      \`\`\`json
      {
        "quizzes": [
          {
            "questionType": "multiple choice",
            "question": "Which country was invaded by Germany in 1939, starting World War II?",
            "options": ["Poland", "France", "Czech Republic", "Belgium"],
            "answer": "Poland",
            "points": 3,
            "explanation": "Germany's invasion of Poland on September 1, 1939, marked the beginning of World War II."
          },
          {
            "questionType": "short answer",
            "question": "What was the name of the operation in which the Allies invaded Normandy in 1944?",
            "options": [],
            "answer": "Operation Overlord",
            "points": 7,
            "explanation": "Operation Overlord was the code name for the Allied invasion of Normandy on June 6, 1944, which led to the liberation of Western Europe."
          },
          {
            "questionType": "multiple choice",
            "question": "What was the name of the alliance between Germany, Italy, and Japan during World War II?",
            "options": ["The Allies", "The Axis Powers", "The Central Powers", "The United Nations"],
            "answer": "The Axis Powers",
            "points": 5,
            "explanation": "The Axis Powers consisted of Germany, Italy, and Japan, who were opposed to the Allies during World War II."
          },
          {
            "questionType": "short answer",
            "question": "What year did the United States drop atomic bombs on Japan?",
            "options": [],
            "answer": "1945",
            "points": 6,
            "explanation": "The United States dropped atomic bombs on Hiroshima and Nagasaki in August 1945, leading to Japan's surrender and the end of World War II."
          }
        ]
      }
      \`\`\`
    `;
  }

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response;
};

/**
 * QUIZ
 * Version 2
 * Create quiz from file (pdf).
 */
const generateQuizWithGoogleAIV2 = async (
  fileUrl,
  academicLevel,
  language,
  questionType,
  numberOfQuestions,
  specificRequirements
) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  if (!fileUrl) {
    throw new Error("Invalid file object. Ensure fileUrl is provided.");
  }

  // Download file from S3 to memory (without saving to disk)
  const fileBuffer = await downloadFileFromS3(fileUrl);

  // Read file and convert to base64
  const base64File = fileBuffer.toString("base64");

  let prompt = "";
  const assumption = `
    You are an expert quiz creator with deep knowledge in various academic fields.
    Your task is to generate a well-structured quiz based on the provided PDF file. 
    Please make sure the quiz is appropriate for the specified academic level and language.

    For each question, assign points based on the following difficulty scale (from 1 to 10 points):
    - Easy questions: 1-3 points
    - Medium questions: 4-6 points
    - Hard questions: 7-10 points
    Easy questions should be simple factual questions, medium questions should require some reasoning or application, and hard questions should be challenging or involve deeper understanding.

    ${
      specificRequirements &&
      `
      # **Specific Requirements provided by User:**
      Please prioritize the following specific requirements in the quiz generation:
      ${specificRequirements}
      `
    }
    
    # **Your Task**
    Analyze the provided PDF file and generate a quiz based on its key concepts and information. 
    The quiz should be tailored to assess the learner's understanding of the content at the ${academicLevel} level, ensuring the questions are appropriately challenging for that level. 
    The quiz must be created in the specified language: ${language}.
    **Do NOT add extra commentary or text; only return the JSON response.**
  `;

  if (questionType === "multiple choice") {
    prompt = `
      ${assumption}
      The quiz should contain ${numberOfQuestions} questions of type "multiple choice". Each question should have:
        - questionType: "multiple choice"
        - question: The question text
        - options: A list of at least 4 options
        - answer: The correct answer
        - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
        - explanation: A brief explanation of why the answer is correct

      # **Expected JSON Output**
      \`\`\`json
      {
        "quizzes": [
          {
            "questionType": "multiple choice",
            "question": "Who was the leader of Nazi Germany during World War II?",
            "options": ["Adolf Hitler", "Winston Churchill", "Joseph Stalin", "Franklin D. Roosevelt"],
            "answer": "Adolf Hitler",
            "points": 2,
            "explanation": "Adolf Hitler was the dictator of Nazi Germany and played a central role in the start of World War II."
          },
          {
            "questionType": "multiple choice",
            "question": "Which event triggered the United States' entry into World War II?",
            "options": ["Attack on Pearl Harbor", "D-Day landings", "The signing of the Treaty of Versailles", "The invasion of Poland"],
            "answer": "Attack on Pearl Harbor",
            "points": 5,
            "explanation": "The Japanese attack on Pearl Harbor on December 7, 1941, led the United States to declare war on Japan and enter World War II."
          },
          {
            "questionType": "multiple choice",
            "question": "What was the significance of the Battle of Stalingrad?",
            "options": ["It was a turning point in favor of the Axis Powers", "It marked the beginning of the end for Nazi Germany", "It was the first major battle between the Allies and Japan", "It was the battle that led to the fall of France"],
            "answer": "It marked the beginning of the end for Nazi Germany",
            "points": 8,
            "explanation": "The Battle of Stalingrad was a major defeat for Nazi Germany and marked the beginning of a series of Allied victories in Europe."
          }
        ]
      }
      \`\`\`
    `;
  } else if (questionType === "short answer") {
    prompt = `
      ${assumption}
      The quiz should contain ${numberOfQuestions} questions of type "short answer". Each question should have:
        - questionType: "short answer"
        - question: The question text
        - options: Leave empty
        - answer: The correct answer
        - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
        - explanation: If needed, provide an explanation of the answer (can be null)

      # **Expected JSON Output**
      \`\`\`json
      {
        "quizzes": [
          {
            "questionType": "short answer",
            "question": "Who was the Prime Minister of the United Kingdom during most of World War II?",
            "options": [],
            "answer": "Winston Churchill",
            "points": 3,
            "explanation": "Winston Churchill was the British Prime Minister from 1940 to 1945 and again from 1951 to 1955, guiding the UK through the darkest days of WWII."
          },
          {
            "questionType": "short answer",
            "question": "What was the main goal of the Nazi regime during World War II?",
            "options": [],
            "answer": "Expansion and domination of Europe",
            "points": 6,
            "explanation": "The Nazi regime, under Adolf Hitler, aimed to expand Germany's territory across Europe and impose its ideology of racial supremacy."
          },
          {
            "questionType": "short answer",
            "question": "What was the role of the Manhattan Project during World War II?",
            "options": [],
            "answer": "Development of atomic weapons",
            "points": 9,
            "explanation": "The Manhattan Project was a secret U.S. government project aimed at developing atomic bombs, which were later used on Hiroshima and Nagasaki in Japan."
          }
        ]
      }
      \`\`\`
    `;
  } else if (questionType === "multiple choice and short answer") {
    prompt = `
      ${assumption}
      The quiz should contain ${numberOfQuestions} questions with a mix of "multiple choice" and "short answer" questions. Ensure that:
        - Half of the questions are "multiple choice" with at least 4 options, and the other half are "short answer".
        - For "multiple choice" questions:
          - questionType: "multiple choice"
          - question: The question text
          - options: A list of at least 4 options
          - answer: The correct answer
          - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
          - explanation: A brief explanation of why the answer is correct
        - For "short answer" questions:
          - questionType: "short answer"
          - question: The question text
          - options: Leave empty
          - answer: The correct answer
          - points: The number of points for the question (assign points from 1 to 10 based on the difficulty)
          - explanation: If needed, provide an explanation of the answer (can be null)

      # **Expected JSON Output**
      \`\`\`json
      {
        "quizzes": [
          {
            "questionType": "multiple choice",
            "question": "Which country was invaded by Germany in 1939, starting World War II?",
            "options": ["Poland", "France", "Czech Republic", "Belgium"],
            "answer": "Poland",
            "points": 3,
            "explanation": "Germany's invasion of Poland on September 1, 1939, marked the beginning of World War II."
          },
          {
            "questionType": "short answer",
            "question": "What was the name of the operation in which the Allies invaded Normandy in 1944?",
            "options": [],
            "answer": "Operation Overlord",
            "points": 7,
            "explanation": "Operation Overlord was the code name for the Allied invasion of Normandy on June 6, 1944, which led to the liberation of Western Europe."
          },
          {
            "questionType": "multiple choice",
            "question": "What was the name of the alliance between Germany, Italy, and Japan during World War II?",
            "options": ["The Allies", "The Axis Powers", "The Central Powers", "The United Nations"],
            "answer": "The Axis Powers",
            "points": 5,
            "explanation": "The Axis Powers consisted of Germany, Italy, and Japan, who were opposed to the Allies during World War II."
          },
          {
            "questionType": "short answer",
            "question": "What year did the United States drop atomic bombs on Japan?",
            "options": [],
            "answer": "1945",
            "points": 6,
            "explanation": "The United States dropped atomic bombs on Hiroshima and Nagasaki in August 1945, leading to Japan's surrender and the end of World War II."
          }
        ]
      }
      \`\`\`
    `;
  }

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64File,
        mimeType: "application/pdf",
      },
    },
    prompt,
  ]);

  const response = await result.response;
  return response;
};

/**
 * Check short answer quiz.
 * Check user answer compared to the correct answer in learning mode.
 */
const checkShortAnswer = async (
  question,
  answer,
  explanation,
  points,
  userAnswer
) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  let prompt = `
    You are an expert evaluator. Your task is to assess the answer provided by the user based on the following information:

    **Question**: "${question}"
    **Correct Answer**: "${answer}"
    **Explanation**: "${explanation ?? "None provided."}"
    **Points**: ${points}
    **User's Answer**: "${userAnswer}"

    Your job is to:
    1. Compare the **User's Answer** with the **Correct Answer**.
    2. Provide a brief feedback on whether the user's answer is correct or incorrect.
    3. Based on the accuracy of the answer, assign a score to the user's answer:
        - If the answer is fully correct, assign the full points.
        - If the answer is partially correct, assign points accordingly.
        - If the answer is incorrect, assign a score of 0 points.
      Ensure that the **userScore** is always less than or equal to the maximum points available for the question (i.e., it cannot exceed ${points}).
    4. Detect the language used in the **User's Answer** or in the **Question** and return your feedback **in the same language**.
    5. **IMPORTANT**: **Do NOT add extra commentary or text; only return the JSON response.**

    **Expected JSON Output Format**:
    \`\`\`json
    {
      "feedback": "Your answer is nearly correct, but you missed some details.",
      "userScore": 3,
    }
    \`\`\`
  `;

  // The model generates feedback and score based on the prompt
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response;
};

module.exports = {
  generateSlideContentWithGoogleAIV1,
  generateSlideContentWithGoogleAIV2,
  generateSlideContentWithGoogleAIV3,
  generateLectureScriptWithGoogleAI,
  generateQuizWithGoogleAIV1,
  generateQuizWithGoogleAIV2,
  checkShortAnswer,
};
