const { spawn } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const fs = require("fs-extra");
const path = require("path");
const { uploadToS3AndGetUrl } = require("./aws-s3");
const { convertPdfToImages } = require("./pdf-to-img");
const { generateSpeech, getVoiceName } = require("./text-to-speech");
const os = require("os");

// Tốc độ giọng nói
const SPEAKING_RATES = {
  slow: 0.8,
  normal: 1.0,
  fast: 1.2,
};

// Cấu hình đường dẫn cho `ffmpeg` và `ffprobe`
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Lấy số lượng CPU cores để tối ưu hóa việc xử lý song song
const CPU_CORES = os.cpus().length;
const MAX_PARALLEL_TASKS = Math.max(1, Math.min(CPU_CORES - 1, 4)); // Giới hạn số tác vụ song song

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
  const startTime = Date.now();
  try {
    const tempDir = path.join(__dirname, "../temp", `job-${Date.now()}`);
    await fs.ensureDir(tempDir);
    console.log(`🔧 Sử dụng tối đa ${MAX_PARALLEL_TASKS} tác vụ song song`);

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

    // Đảm bảo số lượng script và ảnh bằng nhau
    if (numScripts < numImages) {
      slidesToProcess = [
        ...slides,
        ...new Array(numImages - numScripts).fill({ script: "" }),
      ];
    } else if (numScripts > numImages) {
      imageBuffersToProcess = [
        ...imageBuffers,
        ...new Array(numScripts - numImages).fill(
          imageBuffers[imageBuffers.length - 1]
        ),
      ];
    }

    // Tiền xử lý: Lưu tất cả ảnh trước
    console.log(`🖼️ Đang lưu ${imageBuffersToProcess.length} ảnh...`);
    await Promise.all(
      imageBuffersToProcess.map(async (buffer, i) => {
        const slideImagePath = path.join(tempDir, `slide-${i}.png`);
        await fs.writeFile(slideImagePath, buffer);
      })
    );

    // Tiền xử lý: Tạo tất cả file audio trước
    console.log(`🔊 Đang tạo tất cả file audio...`);
    const audioGenerationTasks = slidesToProcess.map((slide, i) => async () => {
      try {
        const speechFile = await generateSpeech(
          slide.script,
          languageCode,
          voiceName,
          speakingRate,
          tempDir,
          i
        );
        return { index: i, path: speechFile, success: true };
      } catch (err) {
        console.warn(
          `⚠️ Không thể tạo speech file cho slide ${
            i + 1
          }, dùng âm thanh mặc định.`
        );
        return {
          index: i,
          path: path.join(__dirname, "silence.wav"),
          success: false,
        };
      }
    });

    // Xử lý audio theo batch để không quá tải hệ thống
    const audioResults = [];
    const batchSize = MAX_PARALLEL_TASKS;

    for (let i = 0; i < audioGenerationTasks.length; i += batchSize) {
      const batch = audioGenerationTasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((task) => task()));
      audioResults.push(...batchResults);
      console.log(
        `🔊 Đã xử lý ${Math.min(i + batchSize, audioGenerationTasks.length)}/${
          audioGenerationTasks.length
        } audio files`
      );
    }

    // Sắp xếp kết quả theo thứ tự ban đầu
    audioResults.sort((a, b) => a.index - b.index);
    const speechFiles = audioResults.map((result) => result.path);

    // Tính toán thời lượng của tất cả file audio
    console.log(
      `⏱️ Đang tính thời lượng cho ${speechFiles.length} file audio...`
    );
    // const durationTasks = speechFiles.map((file, index) => async () => {
    //   const duration = await getAudioDuration(file);
    //   return { index, duration };
    // });

    // // Xử lý duration theo batch
    // const durationResults = [];
    // for (let i = 0; i < durationTasks.length; i += batchSize) {
    //   const batch = durationTasks.slice(i, i + batchSize);
    //   const batchResults = await Promise.all(batch.map((task) => task()));
    //   durationResults.push(...batchResults);
    // }

    // durationResults.sort((a, b) => a.index - b.index);
    // const durations = durationResults.map((result) => result.duration);

    // Xử lý từng slide thành video riêng theo batch
    console.log(
      `🎬 Đang tạo ${slidesToProcess.length} video cho từng slide...`
    );
    const videoProcessingTasks = slidesToProcess.map((_, i) => async () => {
      const slideImagePath = path.join(tempDir, `slide-${i}.png`);
      const speechFile = speechFiles[i];
      const tempVideoPath = path.join(tempDir, `slide-${i}.mp4`);
      // const speechDuration = durations[i];
      const speechDuration = await getAudioDuration(speechFile);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(slideImagePath)
          // .loop(speechDuration)
          .inputOptions(["-framerate 1"]) // Chỉ cần 1 frame mỗi giây vì ảnh tĩnh
          .input(speechFile)
          .outputOptions([
            "-c:v libx264",
            "-preset ultrafast", // Thay đổi từ slow sang ultrafast để tăng tốc độ
            "-tune stillimage",
            "-crf 28", // Tăng CRF để giảm thời gian mã hóa (23 -> 28)
            // "-pix_fmt yuv420p", // Định dạng pixel phổ biến và tương thích với nhiều trình phát -> lỗi conversion failed
            // "-r 30",
            "-r 15", // Giảm fps
            // "-movflags +faststart", // Hỗ trợ phát video nhanh hơn trên web
            // "-shortest", // Đảm bảo video kết thúc khi audio kết thúc
          ])
          .output(tempVideoPath)
          .on("end", resolve)
          .on("error", (err) => {
            console.error(`Error creating video for slide ${i + 1}:`, err);
            reject(err);
          })
          .run();
      });

      return {
        index: i,
        path: tempVideoPath,
        duration: speechDuration,
      };
    });

    // Xử lý video theo batch
    let currentTimestamp = 0;
    const processedVideos = [];

    for (let i = 0; i < videoProcessingTasks.length; i += batchSize) {
      const batch = videoProcessingTasks.slice(i, i + batchSize);
      console.log(
        `🎥 Đang xử lý batch video ${i / batchSize + 1}/${Math.ceil(
          videoProcessingTasks.length / batchSize
        )}...`
      );
      const batchResults = await Promise.all(batch.map((task) => task()));
      processedVideos.push(...batchResults);
    }

    // Sắp xếp lại các video và tính timestamps
    processedVideos.sort((a, b) => a.index - b.index);

    for (const video of processedVideos) {
      videoFiles.push(video.path);
      currentTimestamp += video.duration;
      quizTimestamps.push(currentTimestamp);
    }

    // Ghép tất cả các video thành một video cuối cùng
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

    console.log("📜 Đang ghép video các slide...");

    // Ghép video bằng cách copy stream thay vì encode lại
    await new Promise((resolve, reject) => {
      const ffmpegArgs = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-c",
        "copy", // Chỉ copy stream, không encode lại lần nữa
        "-movflags",
        "+faststart",
        finalVideoPath,
      ];

      const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs);

      ffmpegProcess.stderr.on("data", (data) => {
        const message = data.toString();
        // Chỉ log những thông báo quan trọng để giảm output
        if (message.includes("Error") || message.includes("error")) {
          console.error(`FFmpeg error: ${message}`);
        }
      });

      ffmpegProcess.on("close", (code) => {
        if (code === 0) {
          console.log("✅ FFmpeg ghép video thành công!");
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });

    const endTime = Date.now();
    const processingTimeMinutes = ((endTime - startTime) / 60000).toFixed(2);
    console.log(`⏱️ Tổng thời gian xử lý: ${processingTimeMinutes} phút`);
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

    // Dọn dẹp tệp tin tạm sau khi hoàn thành
    try {
      await fs.remove(tempDir);
      console.log("🧹 Đã dọn dẹp thư mục tạm");
    } catch (cleanupError) {
      console.warn("⚠️ Không thể dọn dẹp thư mục tạm:", cleanupError.message);
    }

    return { videoUrl, quizTimestamps };
  } catch (error) {
    console.error("❌ Lỗi khi tạo video:", error.message, error.stack);
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
