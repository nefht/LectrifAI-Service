const { HfInference } = require("@huggingface/inference");

const HF_API_KEY = process.env.HF_API_KEY;
const hf = new HfInference(HF_API_KEY);

/**
 * Generate slide content using Hugging Face Inference API
 * @param {string} topic - The topic of the slide
 * @param {string} content - The input content for the slide
 * @returns {string} - Generated slide content
 */
async function generateSlideContent(topic, specificRequirements) {
  const prompt = `Give me contents for slides for the topic "${topic}" and the following related information and requirements: "${specificRequirements}. Each slide should have a title, bullet points, and images if necessary."`;

  try {
    const response = await hf.textGeneration({
      model: "gpt2",
      inputs: prompt,
      parameters: {
        max_new_tokens: 200, // Số lượng token tối đa sinh ra
        temperature: 0.7, // Độ sáng tạo
        top_p: 0.9, // Lấy top 90% xác suất token
      },
    });

    // Trích xuất nội dung từ kết quả
    return response.generated_text;
  } catch (error) {
    console.error("Error generating slide content:", error.message);
    throw new Error("Failed to generate slide content.");
  }
}

module.exports = { generateSlideContent };
