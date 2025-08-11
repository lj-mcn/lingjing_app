const functions = require("firebase-functions")
const admin = require("firebase-admin")
const { HttpsError } = require("firebase-functions/v1/https")

// Load environment variables in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

// 初始化 Firebase Admin SDK
admin.initializeApp()

// 导入你的服务模块
const sttService = require("./services/sttServiceEnhanced")
const llmService = require("./services/llmService")
const ttsService = require("./services/ttsServiceEnhanced")

// 您的主业务逻辑 Cloud Function
// 使用 onCall 触发器，因为它可以自动处理认证，并且比 onRequest 接口更简单
exports.processVoiceInput = functions.https.onCall(async (data, context) => {
  // 1. 认证检查
  // 如果需要用户登录才能使用，可以使用 context.auth
  if (!context.auth) {
    throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
    )
  }

  // 2. 参数验证
  // 前端调用时，需要在请求体中传入音频数据（通常是 base64 编码的字符串）
  const audioBase64 = data.audio
  if (!audioBase64) {
    throw new HttpsError(
        "invalid-argument",
        "Audio data is required.",
    )
  }

  try {
    // 3. 调用 STT 服务进行语音转文字
    // 假设 sttService.transcribeAudio 接收 base64 字符串
    console.log("Starting STT transcription...")
    const userPrompt = await sttService.transcribeAudio(audioBase64)
    console.log(`STT Result: ${userPrompt}`)

    // 4. 调用 LLM 服务生成回复
    // 假设 llmService.generateResponse 接收文本并返回文本
    console.log("Generating LLM response...")
    const llmResponseText = await llmService.generateResponse(userPrompt)
    console.log(`LLM Response: ${llmResponseText}`)

    // 5. 调用 TTS 服务将回复转为音频文件
    // 假设 ttsService.generateAudio 接收文本并返回音频文件的 URL
    console.log("Generating TTS audio...")
    const audioUrl = await ttsService.generateAudio(llmResponseText)
    console.log(`TTS Audio URL: ${audioUrl}`)

    // 6. 将最终结果返回给前端
    return {
      success: true,
      audioUrl,
      responseText: llmResponseText, // 也可以将文本一起返回
    }
  } catch (error) {
    console.error("An error occurred:", error)
    // 抛出 HTTPS 错误，前端可以更容易地处理
    throw new HttpsError(
        "internal",
        "An internal server error occurred.",
        error.message,
    )
  }
})

// Export WebSocket service
const { websocketApp } = require("./websocketService")

exports.websocketService = websocketApp
