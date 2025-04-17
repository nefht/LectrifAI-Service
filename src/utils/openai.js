// Tạo nội dung cho slides
const openai = require("../config/openai");

const generateSlideContent = async (topic, content) => {
  const prompt = `Create a content for slides about ${topic}. The content of the slides is about: ${content}`;
  try {
    const response = await openai.completions.create({
      model: "gpt-3.5-turbo",
      prompt: prompt,
      max_tokens: 100,
    });
    return response.data.choices[0].text;

  } catch (error) {
    console.error("Error generating slide content:", error);
    return null;
  }
};

module.exports = { generateSlideContent };