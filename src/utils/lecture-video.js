const { spawn } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const fs = require("fs-extra");
const path = require("path");
const { uploadToS3AndGetUrl } = require("./aws-s3");
const { convertPdfToImages } = require("./pdf-to-img");
const { generateSpeech, getVoiceName } = require("./text-to-speech");

// Tốc độ giọng nói
const SPEAKING_RATES = {
  slow: 0.8,
  normal: 1.0,
  fast: 1.2,
};

// Cấu hình đường dẫn cho `ffmpeg` và `ffprobe`
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Tạo video từ file slide PDF và script bài giảng
 * @param {Buffer} pdfBuffer - File PDF chứa các slide
 * @param {Array} slides - Danh sách nội dung script từng slide (có quiz timestamps)
 * @param {string} folder - Thư mục trên S3 để lưu video
 * @param {string} languageCode - "vi-VN", "en-US"
 * @param {string} voiceType - "MALE", "FEMALE"
 * @param {string} lectureSpeed - Tốc độ giọng nói
 * @returns {Promise<{ videoUrl: string, quizTimestamps: number[] }>}
 */
const createVideo = async (
  pdfBuffer,
  slides,
  folder,
  languageCode,
  voiceType,
  lectureSpeed
) => {
  try {
    const tempDir = path.join(__dirname, "../temp");
    await fs.ensureDir(tempDir);

    // Chuyển đổi PDF thành danh sách ảnh
    const imageBuffers = await convertPdfToImages(pdfBuffer);
    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error("No images were generated from PDF.");
    }
    console.log(`📸 Đã tạo ${imageBuffers.length} ảnh từ PDF.`);

    let currentTime = 0;
    const quizTimestamps = [];
    const videoFiles = [];
    const voiceName = await getVoiceName(languageCode, voiceType);
    const speakingRate = SPEAKING_RATES[lectureSpeed] || 1.0;

    let slidesToProcess = slides;
    let imageBuffersToProcess = imageBuffers;

    const numScripts = slides.length;
    const numImages = imageBuffers.length;
    if (numScripts < numImages) {
      slidesToProcess = [
        ...slides,
        ...new Array(numScripts - numImages).fill({ script: "" }),
      ];
    } else if (numScripts > numImages) {
      imageBuffersToProcess = [
        ...imageBuffers,
        ...new Array(numScripts - numImages).fill(
          imageBuffers[imageBuffers.length - 1]
        ),
      ];
    }

    for (let i = 0; i < slidesToProcess.length; i++) {
      console.log(`🎞️ Đang xử lý slide ${i + 1}/${slidesToProcess.length}...`);

      const slide = slidesToProcess[i];
      const slideImagePath = path.join(tempDir, `slide-${i}.png`);
      await fs.writeFile(slideImagePath, imageBuffersToProcess[i]);
      console.log(`🖼️ Đã lưu ảnh slide ${i + 1}: ${slideImagePath}`);

      if (!fs.existsSync(slideImagePath)) {
        throw new Error(`❌ Không tìm thấy file ảnh: ${slideImagePath}`);
      }

      let speechFile;
      try {
        speechFile = await generateSpeech(
          slide.script,
          languageCode,
          voiceName,
          speakingRate
        );
        console.log(`🔊 Speech file tạo thành công: ${speechFile}`);
      } catch (err) {
        console.warn(
          `⚠️ Không thể tạo speech file cho slide ${
            i + 1
          }, dùng âm thanh mặc định.`
        );
        speechFile = path.join(__dirname, "silence.mp3");
      }

      if (!fs.existsSync(speechFile)) {
        throw new Error(`❌ Không tìm thấy file âm thanh: ${speechFile}`);
      }

      const tempVideoPath = path.join(tempDir, `slide-${i}.mp4`);
      console.log(
        `🎥 Tạo video: Ảnh = ${slideImagePath}, Âm thanh = ${speechFile}, Đầu ra = ${tempVideoPath}`
      );

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(slideImagePath)
          .input(speechFile)
          .output(tempVideoPath)
          .outputOptions([
            "-c:v libx264",
            "-preset slow",
            "-crf 23",
            "-r 25", // Đồng bộ FPS
            "-g 30", // Đảm bảo keyframe hợp lệ
          ])
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      console.log(`🎬 Đã tạo video cho slide ${i + 1}: ${tempVideoPath}`);
      videoFiles.push(tempVideoPath);

      const speechDuration = await getAudioDuration(speechFile);
      currentTime += speechDuration;

      // // Lấy thời điểm có quiz
      // if (slide.quiz) quizTimestamps.push(currentTime);

      // Lấy thời điểm cuối cùng của từng slide
      quizTimestamps.push(currentTime);
    }

    const finalVideoPath = path.join(
      tempDir,
      `lecture-video-${Date.now()}.mp4`
    );
    const concatFilePath = path.join(tempDir, "input.txt");

    // Ghi danh sách file video vào `input.txt`
    const concatContent = videoFiles
      .map((file) => `file '${path.resolve(file)}'`)
      .join("\n");
    await fs.writeFile(concatFilePath, concatContent, "utf-8");

    console.log("📜 Nội dung file input.txt:\n", concatContent);
    console.log("📜 Đang ghép video các slide...");

    // Kiểm tra tất cả file video có tồn tại không
    for (const file of videoFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`❌ File video bị thiếu: ${file}`);
      }
    }

    // Ghép video
    await new Promise((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpegStatic, [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "23",
        "-bsf:v",
        "h264_mp4toannexb", // Fix lỗi bitstream
        "-movflags",
        "+faststart", // Tối ưu playback trên web
        "-r",
        "25", // Đồng bộ FPS
        "-g",
        "30", // Đảm bảo keyframe hợp lệ
        finalVideoPath,
      ]);

      ffmpegProcess.stdout.on("data", (data) => console.log(`FFmpeg: ${data}`));
      ffmpegProcess.stderr.on("data", (data) =>
        console.error(`FFmpeg lỗi: ${data}`)
      );

      ffmpegProcess.on("close", (code) => {
        if (code === 0) {
          console.log("✅ FFmpeg ghép video thành công!");
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });

    console.log(`✅ Video hoàn tất: ${finalVideoPath}`);

    const videoUrl = await uploadToS3AndGetUrl(
      {
        buffer: fs.readFileSync(finalVideoPath),
        originalname: "lecture.mp4",
        mimetype: "video/mp4",
      },
      folder
    );

    console.log(`🚀 Đã upload video lên S3: ${videoUrl}`);

    await fs.remove(tempDir);

    return { videoUrl, quizTimestamps };
  } catch (error) {
    console.error("❌ Lỗi khi tạo video:", error.message);
    throw new Error("Error creating lecture video: " + error.message);
  }
};

/**
 * Lấy thời lượng của file audio
 * @param {string} audioFile - Đường dẫn file âm thanh
 * @returns {Promise<number>} - Thời gian (giây)
 */
const getAudioDuration = async (audioFile) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioFile, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
};

module.exports = { createVideo };
