const { AutoModelForCausalLM, AutoTokenizer } = require("transformers");

let model, tokenizer;

// Hàm tải mô hình (chạy 1 lần khi khởi động server)
async function loadModel() {
  try {
    console.log("Loading model...");
    tokenizer = await AutoTokenizer.fromPretrained("gpt2");
    model = await AutoModelForCausalLM.fromPretrained("gpt2");
    console.log("Model loaded successfully.");
  } catch (error) {
    console.error("Error loading model:", error.message);
    throw new Error("Failed to load model or tokenizer.");
  }
}

// Hàm sinh nội dung cho slide
async function generateSlideContent(topic, content) {
  await loadModel();
  if (!model || !tokenizer) {
    throw new Error("Model is not loaded.");
  }

  const prompt = `Create a detailed slides content based on the topic "${topic}" and the following input content: "${content}"`;

  try {
    // Tokenize input
    const inputs = tokenizer(prompt, { return_tensors: "pt" });

    // Generate output
    const outputs = await model.generate(inputs.input_ids, {
      max_new_tokens: 200, // Số lượng token tối đa trong output
      temperature: 0.7, // Độ sáng tạo
    });

    // Decode output
    const generatedText = tokenizer.decode(outputs[0], {
      skip_special_tokens: true,
    });
    return generatedText;
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
}

module.exports = { loadModel, generateSlideContent };
