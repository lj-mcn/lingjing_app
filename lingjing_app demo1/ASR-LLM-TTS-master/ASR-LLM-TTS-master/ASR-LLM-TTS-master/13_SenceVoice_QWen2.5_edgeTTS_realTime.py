import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import asyncio
import websockets
import json
import threading

# --- 配置huggingFace国内镜像 ---
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

# WebSocket服务器配置
WS_HOST = "localhost"
WS_PORT = 8765


# --- QWen2.5大语言模型 ---
# model_name = r"E:\2_PYTHON\Project\GPT\QWen\Qwen2.5-0.5B-Instruct"
model_name = r"E:\2_PYTHON\Project\GPT\QWen\Qwen2.5-1.5B-Instruct"
# model_name = r'E:\2_PYTHON\Project\GPT\QWen\Qwen2.5-7B-Instruct-GPTQ-Int4'
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

def llm_inference(prompt):
    """
    大模型推理函数
    Args:
        prompt: 用户输入的文本
    Returns:
        output_text: 模型生成的回复
    """
    try:
        # -------- 模型推理阶段 ------
        messages = [
            {"role": "system", "content": "你叫千问，是一个18岁的女大学生，性格活泼开朗，说话俏皮"},
            {"role": "user", "content": prompt + "，回答简短一些，保持50字以内！"},
        ]
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=512,
        )
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        output_text = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
        print("LLM回复:", output_text)
        
        return output_text
    except Exception as e:
        print(f"LLM推理错误: {e}")
        return "抱歉，我遇到了一些问题，请稍后再试。"

async def handle_websocket_message(websocket, path):
    """
    处理WebSocket消息
    """
    print(f"新的WebSocket连接: {websocket.remote_address}")
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                print(f"收到消息: {data}")
                
                if data.get("type") == "text":
                    prompt = data.get("data", "")
                    model_name = data.get("model", "Qwen2.5-1.5B-Instruct")
                    
                    if not prompt:
                        await websocket.send(json.dumps({
                            "status": "error",
                            "message": "缺少prompt参数"
                        }))
                        continue
                    
                    # 发送处理中状态
                    await websocket.send(json.dumps({
                        "status": "processing",
                        "message": "正在处理您的请求..."
                    }))
                    
                    # 调用大模型推理
                    response = llm_inference(prompt)
                    
                    # 发送成功响应
                    await websocket.send(json.dumps({
                        "status": "success",
                        "llm_response": response,
                        "model": model_name
                    }))
                
                elif data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "status": "pong"
                    }))
                
                else:
                    await websocket.send(json.dumps({
                        "status": "error",
                        "message": f"未知消息类型: {data.get('type')}"
                    }))
                    
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    "status": "error",
                    "message": "JSON格式错误"
                }))
            except Exception as e:
                print(f"处理消息时出错: {e}")
                await websocket.send(json.dumps({
                    "status": "error",
                    "message": str(e)
                }))
                
    except websockets.exceptions.ConnectionClosed:
        print(f"WebSocket连接关闭: {websocket.remote_address}")
    except Exception as e:
        print(f"WebSocket错误: {e}")

async def start_websocket_server():
    """
    启动WebSocket服务器
    """
    print(f"启动WebSocket服务器 ws://{WS_HOST}:{WS_PORT}")
    server = await websockets.serve(handle_websocket_message, WS_HOST, WS_PORT)
    print("WebSocket服务器已启动，等待连接...")
    await server.wait_closed()

# 主函数
if __name__ == "__main__":
    print("启动QWen2.5大模型WebSocket服务...")
    print("模型加载完成！")
    asyncio.run(start_websocket_server())
